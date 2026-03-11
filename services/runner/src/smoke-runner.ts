import crypto from "node:crypto";
import {
  nowIsoTimestamp,
  type ExperimentRun,
  type ExperimentRunStatus,
} from "@deepscholar/contracts";
import type { DockerClient } from "./docker-client.ts";
import type { RunStore } from "./run-store-fs.ts";

export type SmokeRunOptions = {
  readonly projectId: string;
  readonly planId: string;
  readonly experimentId: string;
  readonly image: string;
  readonly holdSeconds: number;
  readonly timeoutMs: number;
};

function containerName(projectId: string, runId: string): string {
  const safe = (value: string) => value.replaceAll(/[^a-zA-Z0-9_.-]/g, "_");
  const name = `deepscholar_${safe(projectId)}_${safe(runId)}`;
  return name.length > 120 ? name.slice(0, 120) : name;
}

function setStatus(
  run: ExperimentRun,
  status: ExperimentRunStatus,
  patch: Partial<ExperimentRun>,
): ExperimentRun {
  return { ...run, ...patch, status, updatedAt: nowIsoTimestamp() };
}

function markRunning(run: ExperimentRun, name: string): ExperimentRun {
  return setStatus(run, "running", {
    startedAt: nowIsoTimestamp(),
    execution: { driver: "docker", containerName: name },
    metricsPath: "metrics.json",
    artifacts: [
      { path: "stdout.log", kind: "log", description: "docker stdout" },
      { path: "stderr.log", kind: "log", description: "docker stderr" },
      { path: "metrics.json", kind: "metric", description: "smoke metrics" },
    ],
  });
}

function finalizeRun(
  running: ExperimentRun,
  result: { readonly exitCode: number | null; readonly timedOut: boolean },
): ExperimentRun {
  const finishedAt = nowIsoTimestamp();
  if (result.timedOut) {
    return setStatus(running, "timeout", { finishedAt, exitCode: result.exitCode ?? undefined });
  }
  if (result.exitCode === 0) {
    return setStatus(running, "succeeded", { finishedAt, exitCode: 0 });
  }
  return setStatus(running, "failed", {
    finishedAt,
    exitCode: result.exitCode ?? undefined,
    failure: { type: "implementation", message: `exitCode=${String(result.exitCode ?? "null")}` },
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
  const running = markRunning(created.run, name);
  await store.save(running);

  const result = await docker.runSmoke({
    containerName: name,
    image: options.image,
    runDir: created.paths.runDir,
    stdoutPath: created.paths.stdoutPath,
    stderrPath: created.paths.stderrPath,
    holdSeconds: options.holdSeconds,
    timeoutMs: options.timeoutMs,
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
  const aborted = setStatus(run, "aborted", {
    finishedAt: nowIsoTimestamp(),
    failure: { type: "infrastructure", message: "aborted by user" },
  });
  await store.save(aborted);
  return aborted;
}
