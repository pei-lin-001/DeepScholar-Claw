import crypto from "node:crypto";
import {
  nowIsoTimestamp,
  type ExperimentExecutionRequest,
  type ExperimentRun,
} from "@deepscholar/contracts";
import type { DockerClient } from "./docker-client.ts";
import type { DockerSandboxProfile } from "./docker-sandbox.ts";
import type { RunStore } from "./run-store-fs.ts";
import { containerName, finalizeRun, setRunStatus } from "./runner-utils.ts";

export type SmokeRunOptions = {
  readonly projectId: string;
  readonly planId: string;
  readonly experimentId: string;
  readonly image: string;
  readonly sandboxProfile: DockerSandboxProfile;
  readonly holdSeconds: number;
  readonly timeoutMs: number;
  readonly retryOfRunId?: string;
};

function executionRequest(options: SmokeRunOptions): ExperimentExecutionRequest {
  return {
    driver: "docker",
    kind: "smoke",
    image: options.image,
    sandboxProfile: options.sandboxProfile,
    holdSeconds: options.holdSeconds,
    timeoutMs: options.timeoutMs,
  };
}

function markRunning(run: ExperimentRun, name: string, options: SmokeRunOptions): ExperimentRun {
  return setRunStatus(run, "running", {
    startedAt: nowIsoTimestamp(),
    execution: { driver: "docker", containerName: name },
    executionRequest: executionRequest(options),
    retryOfRunId: options.retryOfRunId,
    metricsPath: "metrics.json",
    artifacts: [
      { path: "stdout.log", kind: "log", description: "docker stdout" },
      { path: "stderr.log", kind: "log", description: "docker stderr" },
      { path: "metrics.json", kind: "metric", description: "smoke metrics" },
    ],
  });
}

export async function runSmokeExperiment(
  store: RunStore,
  docker: DockerClient,
  options: SmokeRunOptions,
): Promise<ExperimentRun> {
  const runId = `run-${crypto.randomUUID()}`;
  const created = await store.create({
    runId,
    projectId: options.projectId,
    planId: options.planId,
    experimentId: options.experimentId,
  });

  const name = containerName(options.projectId, runId);
  const running = markRunning(created.run, name, options);
  await store.save(running);

  const result = await docker.runSmoke({
    containerName: name,
    image: options.image,
    runDir: created.paths.runDir,
    stdoutPath: created.paths.stdoutPath,
    stderrPath: created.paths.stderrPath,
    holdSeconds: options.holdSeconds,
    timeoutMs: options.timeoutMs,
    sandboxProfile: options.sandboxProfile,
  });
  const finalized = finalizeRun(running, { exitCode: result.exitCode, timedOut: result.timedOut });
  await store.save(finalized);
  return finalized;
}

export async function abortRun(
  store: RunStore,
  docker: DockerClient,
  input: { readonly projectId: string; readonly runId: string },
): Promise<ExperimentRun> {
  const run = await store.load(input.projectId, input.runId);
  if (run.status !== "running") {
    throw new Error(`只能 abort running 状态的 run，当前状态: ${run.status}`);
  }
  if (run.execution?.driver !== "docker" || !run.execution.containerName) {
    throw new Error("run 缺少 docker containerName，无法 abort");
  }
  await docker.stop(run.execution.containerName);
  const aborted = setRunStatus(run, "aborted", {
    finishedAt: nowIsoTimestamp(),
    failure: { type: "infrastructure", message: "aborted by user" },
  });
  await store.save(aborted);
  return aborted;
}
