import { spawn } from "node:child_process";
import fs from "node:fs";

export type DockerRunResult = {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly timedOut: boolean;
};

export type DockerClient = {
  runSmoke: (input: {
    readonly containerName: string;
    readonly image: string;
    readonly runDir: string;
    readonly stdoutPath: string;
    readonly stderrPath: string;
    readonly holdSeconds: number;
    readonly timeoutMs: number;
  }) => Promise<DockerRunResult>;
  stop: (containerName: string) => Promise<void>;
};

type SpawnOutput = {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly timedOut: boolean;
};

function createAppendStream(filePath: string): fs.WriteStream {
  return fs.createWriteStream(filePath, { flags: "a" });
}

function dockerNotFoundError(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "code" in err && err.code === "ENOENT");
}

async function spawnToFiles(params: {
  readonly args: readonly string[];
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly timeoutMs: number;
  readonly onTimeout: () => Promise<void>;
}): Promise<SpawnOutput> {
  const stdoutStream = createAppendStream(params.stdoutPath);
  const stderrStream = createAppendStream(params.stderrPath);

  const child = spawn("docker", params.args, { stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.pipe(stdoutStream);
  child.stderr?.pipe(stderrStream);

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    stderrStream.write("[runner] docker command timed out, attempting cleanup...\n");
    params.onTimeout().catch((err) => {
      stderrStream.write(`[runner] timeout cleanup failed: ${String(err)}\n`);
    });
    child.kill("SIGKILL");
  }, params.timeoutMs);

  try {
    const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code, signal) => resolve({ code, signal }));
      },
    );
    return { exitCode: exit.code, signal: exit.signal, timedOut };
  } catch (err) {
    if (dockerNotFoundError(err)) {
      throw new Error("Docker 不可用：找不到 docker 命令（请先安装并确保在 PATH 中）", {
        cause: err,
      });
    }
    throw err;
  } finally {
    clearTimeout(timeout);
    stdoutStream.end();
    stderrStream.end();
  }
}

function smokeScript(holdSeconds: number): string {
  const hold = Number.isFinite(holdSeconds) && holdSeconds > 0 ? Math.floor(holdSeconds) : 1;
  return [
    "set -e",
    'echo "smoke: start"',
    `sleep ${hold}`,
    'echo "{\\"health\\": 1}" > /out/metrics.json',
    'echo "smoke: done"',
  ].join("; ");
}

function buildSmokeArgs(input: {
  readonly containerName: string;
  readonly image: string;
  readonly runDir: string;
  readonly holdSeconds: number;
}): string[] {
  return [
    "run",
    "--rm",
    "--name",
    input.containerName,
    "--network",
    "none",
    "-v",
    `${input.runDir}:/out`,
    input.image,
    "sh",
    "-lc",
    smokeScript(input.holdSeconds),
  ];
}

export function createNodeDockerClient(): DockerClient {
  async function runSmoke(input: {
    readonly containerName: string;
    readonly image: string;
    readonly runDir: string;
    readonly stdoutPath: string;
    readonly stderrPath: string;
    readonly holdSeconds: number;
    readonly timeoutMs: number;
  }): Promise<DockerRunResult> {
    const args = buildSmokeArgs(input);
    return await spawnToFiles({
      args,
      stdoutPath: input.stdoutPath,
      stderrPath: input.stderrPath,
      timeoutMs: input.timeoutMs,
      onTimeout: async () => {
        await stop(input.containerName);
      },
    });
  }

  async function stop(containerName: string): Promise<void> {
    const args = ["stop", containerName];
    const output = await spawnToFiles({
      args,
      stdoutPath: "/dev/null",
      stderrPath: "/dev/null",
      timeoutMs: 10_000,
      onTimeout: async () => {},
    });
    if (output.timedOut) {
      throw new Error(`docker stop 超时: ${containerName}`);
    }
    if (output.exitCode !== 0) {
      throw new Error(`docker stop 失败(exitCode=${String(output.exitCode)}): ${containerName}`);
    }
  }

  return { runSmoke, stop };
}
