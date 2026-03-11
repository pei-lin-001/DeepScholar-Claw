import { ensureDockerImageAvailable } from "./docker-image-ensure.ts";
import { appendRunnerNote } from "./docker-notes.ts";
import { dockerSandboxArgs, type DockerSandboxProfile } from "./docker-sandbox.ts";
import { spawnDockerCapture, spawnDockerToFiles } from "./docker-spawn.ts";
import { createTimeoutBudget, remainingTimeoutMs, type TimeoutBudget } from "./docker-timeout.ts";

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
    readonly sandboxProfile: DockerSandboxProfile;
  }) => Promise<DockerRunResult>;
  runProgram: (input: {
    readonly containerName: string;
    readonly image: string;
    readonly runDir: string;
    readonly stdoutPath: string;
    readonly stderrPath: string;
    readonly command: readonly string[];
    readonly timeoutMs: number;
    readonly sandboxProfile: DockerSandboxProfile;
  }) => Promise<DockerRunResult>;
  stop: (containerName: string) => Promise<void>;
};

const DOCKER_STOP_TIMEOUT_MS = 10_000;

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

function buildRunArgs(input: {
  readonly containerName: string;
  readonly image: string;
  readonly runDir: string;
  readonly sandboxProfile: DockerSandboxProfile;
  readonly command: readonly string[];
}): string[] {
  return [
    "run",
    "--rm",
    "--name",
    input.containerName,
    "--network",
    "none",
    ...dockerSandboxArgs(input.sandboxProfile),
    "-v",
    `${input.runDir}:/out`,
    input.image,
    ...input.command,
  ];
}

function isNoSuchContainer(stderr: string): boolean {
  const normalized = stderr.toLowerCase();
  return normalized.includes("no such container") || normalized.includes("is not running");
}

async function runDockerContainer(input: {
  readonly containerName: string;
  readonly image: string;
  readonly runDir: string;
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly sandboxProfile: DockerSandboxProfile;
  readonly command: readonly string[];
  readonly budget: TimeoutBudget;
  readonly stopContainer: (containerName: string) => Promise<void>;
}): Promise<DockerRunResult> {
  const timeoutMs = remainingTimeoutMs(input.budget);
  if (timeoutMs <= 0) {
    await appendRunnerNote(
      input.stderrPath,
      "stage=container.run skipped (timeout budget exhausted)",
    );
    return { exitCode: null, signal: null, timedOut: true };
  }
  await appendRunnerNote(
    input.stderrPath,
    `stage=sandbox profile=${input.sandboxProfile} network=none`,
  );
  const args = buildRunArgs({
    containerName: input.containerName,
    image: input.image,
    runDir: input.runDir,
    sandboxProfile: input.sandboxProfile,
    command: input.command,
  });
  await appendRunnerNote(input.stderrPath, `stage=container.run image=${input.image}`);
  return await spawnDockerToFiles({
    args,
    stdoutPath: input.stdoutPath,
    stderrPath: input.stderrPath,
    timeoutMs,
    onTimeout: async () => {
      await input.stopContainer(input.containerName);
    },
  });
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
    readonly sandboxProfile: DockerSandboxProfile;
  }): Promise<DockerRunResult> {
    const command = ["sh", "-lc", smokeScript(input.holdSeconds)];
    return await runProgram({
      containerName: input.containerName,
      image: input.image,
      runDir: input.runDir,
      stdoutPath: input.stdoutPath,
      stderrPath: input.stderrPath,
      command,
      timeoutMs: input.timeoutMs,
      sandboxProfile: input.sandboxProfile,
    });
  }

  async function runProgram(input: {
    readonly containerName: string;
    readonly image: string;
    readonly runDir: string;
    readonly stdoutPath: string;
    readonly stderrPath: string;
    readonly command: readonly string[];
    readonly timeoutMs: number;
    readonly sandboxProfile: DockerSandboxProfile;
  }): Promise<DockerRunResult> {
    const budget = createTimeoutBudget(input.timeoutMs);
    const ensureImage = await ensureDockerImageAvailable({
      image: input.image,
      stdoutPath: input.stdoutPath,
      stderrPath: input.stderrPath,
      budget,
    });
    if (ensureImage) {
      return ensureImage;
    }

    return await runDockerContainer({
      containerName: input.containerName,
      image: input.image,
      runDir: input.runDir,
      stdoutPath: input.stdoutPath,
      stderrPath: input.stderrPath,
      sandboxProfile: input.sandboxProfile,
      command: input.command,
      budget,
      stopContainer: stop,
    });
  }

  async function stop(containerName: string): Promise<void> {
    const output = await spawnDockerCapture({
      args: ["stop", containerName],
      timeoutMs: DOCKER_STOP_TIMEOUT_MS,
    });
    if (output.timedOut) {
      throw new Error(`docker stop 超时: ${containerName}`);
    }
    if (output.exitCode === 0) {
      return;
    }
    if (isNoSuchContainer(output.stderr)) {
      return;
    }
    throw new Error(
      `docker stop 失败(exitCode=${String(output.exitCode)}): ${containerName}: ${output.stderr.trim()}`,
    );
  }

  return { runSmoke, runProgram, stop };
}
