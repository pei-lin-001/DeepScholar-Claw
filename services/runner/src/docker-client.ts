import fsPromises from "node:fs/promises";
import { spawnDockerCapture, spawnDockerToFiles } from "./docker-spawn.ts";

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

const UTF8 = "utf8";
const DOCKER_STOP_TIMEOUT_MS = 10_000;
const MAX_DOCKER_ERROR_SNIPPET_CHARS = 200;

async function appendRunnerNote(stderrPath: string, line: string): Promise<void> {
  const suffix = line.endsWith("\n") ? "" : "\n";
  await fsPromises.appendFile(stderrPath, `[runner] ${line}${suffix}`, UTF8);
}

function singleLineSnippet(text: string): string {
  const first = text.split("\n")[0] ?? "";
  const trimmed = first.trim();
  if (trimmed.length <= MAX_DOCKER_ERROR_SNIPPET_CHARS) {
    return trimmed;
  }
  return `${trimmed.slice(0, MAX_DOCKER_ERROR_SNIPPET_CHARS)}…`;
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

type TimeoutBudget = {
  readonly startedAtMs: number;
  readonly totalTimeoutMs: number;
};

function createTimeoutBudget(totalTimeoutMs: number): TimeoutBudget {
  return { startedAtMs: Date.now(), totalTimeoutMs };
}

function remainingTimeoutMs(budget: TimeoutBudget): number {
  const elapsedMs = Date.now() - budget.startedAtMs;
  return Math.max(0, budget.totalTimeoutMs - elapsedMs);
}

function isNoSuchContainer(stderr: string): boolean {
  const normalized = stderr.toLowerCase();
  return normalized.includes("no such container") || normalized.includes("is not running");
}

type ImageInspectResult = {
  readonly found: boolean;
  readonly timedOut: boolean;
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly imageId?: string;
  readonly stderr: string;
};

async function inspectImage(input: {
  readonly image: string;
  readonly stderrPath: string;
  readonly budget: TimeoutBudget;
}): Promise<ImageInspectResult> {
  await appendRunnerNote(input.stderrPath, `stage=image.inspect image=${input.image}`);
  const timeoutMs = remainingTimeoutMs(input.budget);
  if (timeoutMs <= 0) {
    await appendRunnerNote(
      input.stderrPath,
      "stage=image.inspect skipped (timeout budget exhausted)",
    );
    return { found: false, timedOut: true, exitCode: null, signal: null, stderr: "" };
  }
  const result = await spawnDockerCapture({
    args: ["image", "inspect", "--format", "{{.Id}}", input.image],
    timeoutMs,
  });
  if (result.timedOut) {
    await appendRunnerNote(input.stderrPath, "stage=image.inspect timeout");
    return {
      found: false,
      timedOut: true,
      exitCode: result.exitCode,
      signal: result.signal,
      stderr: "",
    };
  }
  if (result.exitCode === 0) {
    const imageId = result.stdout.trim();
    await appendRunnerNote(input.stderrPath, `stage=image.inspect ok id=${imageId || "unknown"}`);
    return {
      found: true,
      timedOut: false,
      exitCode: result.exitCode,
      signal: result.signal,
      imageId,
      stderr: "",
    };
  }
  return {
    found: false,
    timedOut: false,
    exitCode: result.exitCode,
    signal: result.signal,
    stderr: result.stderr,
  };
}

async function pullImage(input: {
  readonly image: string;
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly budget: TimeoutBudget;
}): Promise<DockerRunResult> {
  await appendRunnerNote(input.stderrPath, `stage=image.pull image=${input.image}`);
  const timeoutMs = remainingTimeoutMs(input.budget);
  if (timeoutMs <= 0) {
    await appendRunnerNote(input.stderrPath, "stage=image.pull skipped (timeout budget exhausted)");
    return { exitCode: null, signal: null, timedOut: true };
  }
  const result = await spawnDockerToFiles({
    args: ["pull", input.image],
    stdoutPath: input.stdoutPath,
    stderrPath: input.stderrPath,
    timeoutMs,
    onTimeout: async () => {},
  });
  if (result.timedOut) {
    return { exitCode: result.exitCode, signal: result.signal, timedOut: true };
  }
  if (result.exitCode !== 0) {
    await appendRunnerNote(
      input.stderrPath,
      `stage=image.pull failed exitCode=${String(result.exitCode)}`,
    );
    return { exitCode: result.exitCode, signal: result.signal, timedOut: false };
  }
  await appendRunnerNote(input.stderrPath, "stage=image.pull ok");
  return { exitCode: result.exitCode, signal: result.signal, timedOut: false };
}

async function ensureImageAvailable(input: {
  readonly image: string;
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly budget: TimeoutBudget;
}): Promise<DockerRunResult | null> {
  const inspect = await inspectImage({
    image: input.image,
    stderrPath: input.stderrPath,
    budget: input.budget,
  });
  if (inspect.timedOut) {
    return { exitCode: inspect.exitCode, signal: inspect.signal, timedOut: true };
  }
  if (inspect.found) {
    return null;
  }
  await appendRunnerNote(
    input.stderrPath,
    `stage=image.inspect miss exitCode=${String(inspect.exitCode)} stderr=${singleLineSnippet(inspect.stderr)}`,
  );
  const pull = await pullImage({
    image: input.image,
    stdoutPath: input.stdoutPath,
    stderrPath: input.stderrPath,
    budget: input.budget,
  });
  return pull.timedOut || pull.exitCode !== 0 ? pull : null;
}

async function runSmokeContainer(input: {
  readonly containerName: string;
  readonly image: string;
  readonly runDir: string;
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly holdSeconds: number;
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
  const args = buildSmokeArgs({
    containerName: input.containerName,
    image: input.image,
    runDir: input.runDir,
    holdSeconds: input.holdSeconds,
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
  }): Promise<DockerRunResult> {
    const budget = createTimeoutBudget(input.timeoutMs);
    const ensureImage = await ensureImageAvailable({
      image: input.image,
      stdoutPath: input.stdoutPath,
      stderrPath: input.stderrPath,
      budget,
    });
    if (ensureImage) {
      return ensureImage;
    }

    return await runSmokeContainer({
      containerName: input.containerName,
      image: input.image,
      runDir: input.runDir,
      stdoutPath: input.stdoutPath,
      stderrPath: input.stderrPath,
      holdSeconds: input.holdSeconds,
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

  return { runSmoke, stop };
}
