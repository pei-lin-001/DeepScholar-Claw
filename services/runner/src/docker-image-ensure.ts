import type { DockerRunResult } from "./docker-client.ts";
import { appendRunnerNote, singleLineSnippet } from "./docker-notes.ts";
import { spawnDockerCapture, spawnDockerToFiles } from "./docker-spawn.ts";
import { remainingTimeoutMs, type TimeoutBudget } from "./docker-timeout.ts";

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

export async function ensureDockerImageAvailable(input: {
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
