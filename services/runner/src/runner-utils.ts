import {
  nowIsoTimestamp,
  type ExperimentRun,
  type ExperimentRunStatus,
} from "@deepscholar/contracts";

export function containerName(projectId: string, runId: string): string {
  const safe = (value: string) => value.replaceAll(/[^a-zA-Z0-9_.-]/g, "_");
  const name = `deepscholar_${safe(projectId)}_${safe(runId)}`;
  return name.length > 120 ? name.slice(0, 120) : name;
}

export function setRunStatus(
  run: ExperimentRun,
  status: ExperimentRunStatus,
  patch: Partial<ExperimentRun>,
): ExperimentRun {
  return { ...run, ...patch, status, updatedAt: nowIsoTimestamp() };
}

export function finalizeRun(
  running: ExperimentRun,
  result: { readonly exitCode: number | null; readonly timedOut: boolean },
): ExperimentRun {
  const finishedAt = nowIsoTimestamp();
  if (result.timedOut) {
    return setRunStatus(running, "timeout", { finishedAt, exitCode: result.exitCode ?? undefined });
  }
  if (result.exitCode === 0) {
    return setRunStatus(running, "succeeded", { finishedAt, exitCode: 0 });
  }
  return setRunStatus(running, "failed", {
    finishedAt,
    exitCode: result.exitCode ?? undefined,
    failure: { type: "implementation", message: `exitCode=${String(result.exitCode ?? "null")}` },
  });
}
