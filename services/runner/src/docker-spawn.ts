import { spawn } from "node:child_process";
import fs from "node:fs";

export type SpawnExit = {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly timedOut: boolean;
};

export type SpawnCaptured = SpawnExit & {
  readonly stdout: string;
  readonly stderr: string;
};

const UTF8 = "utf8";

function createAppendStream(filePath: string): fs.WriteStream {
  return fs.createWriteStream(filePath, { flags: "a" });
}

function dockerNotFoundError(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "code" in err && err.code === "ENOENT");
}

function dockerMissingMessage(err: unknown): Error {
  return new Error("Docker 不可用：找不到 docker 命令（请先安装并确保在 PATH 中）", {
    cause: err,
  });
}

export async function spawnDockerToFiles(params: {
  readonly args: readonly string[];
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly timeoutMs: number;
  readonly onTimeout: () => Promise<void>;
}): Promise<SpawnExit> {
  const stdoutStream = createAppendStream(params.stdoutPath);
  const stderrStream = createAppendStream(params.stderrPath);

  const child = spawn("docker", params.args, { stdio: ["ignore", "pipe", "pipe"] });
  child.stdout?.pipe(stdoutStream);
  child.stderr?.pipe(stderrStream);

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    stderrStream.write("[runner] docker command timed out, attempting cleanup...\n");
    params
      .onTimeout()
      .catch((err) => {
        if (!stderrStream.destroyed) {
          stderrStream.write(`[runner] timeout cleanup failed: ${String(err)}\n`);
        }
      })
      .finally(() => {
        child.kill("SIGKILL");
      });
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
      throw dockerMissingMessage(err);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
    stdoutStream.end();
    stderrStream.end();
  }
}

export async function spawnDockerCapture(params: {
  readonly args: readonly string[];
  readonly timeoutMs: number;
}): Promise<SpawnCaptured> {
  const child = spawn("docker", params.args, { stdio: ["ignore", "pipe", "pipe"] });

  const stdoutChunks: Buffer[] = [];
  const stderrChunks: Buffer[] = [];
  child.stdout?.on("data", (chunk) => {
    stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  });
  child.stderr?.on("data", (chunk) => {
    stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  });

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    child.kill("SIGKILL");
  }, params.timeoutMs);

  try {
    const exit = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
      (resolve, reject) => {
        child.once("error", reject);
        child.once("exit", (code, signal) => resolve({ code, signal }));
      },
    );
    return {
      exitCode: exit.code,
      signal: exit.signal,
      timedOut,
      stdout: Buffer.concat(stdoutChunks).toString(UTF8),
      stderr: Buffer.concat(stderrChunks).toString(UTF8),
    };
  } catch (err) {
    if (dockerNotFoundError(err)) {
      throw dockerMissingMessage(err);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
