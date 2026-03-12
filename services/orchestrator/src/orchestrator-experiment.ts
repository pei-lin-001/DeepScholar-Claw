import { nowIsoTimestamp, type ExperimentRun, type ResearchProject } from "@deepscholar/contracts";
import { checkpointAndSave, actor, type OrchestratorDeps } from "./orchestrator-internals.ts";
import { advanceStep, phaseForStep } from "./step-machine.ts";

const TERMINAL_RUN_STATUSES = ["succeeded", "failed", "aborted", "timeout"] as const;

function isTerminalRunStatus(status: ExperimentRun["status"]): boolean {
  return (TERMINAL_RUN_STATUSES as readonly string[]).includes(status);
}

function requireProjectReady(project: ResearchProject): void {
  if (project.step !== "step8_cloud_experiment") {
    throw new Error(
      `当前步骤不是 step8_cloud_experiment，不能触发/记录实验结果: step=${project.step}`,
    );
  }
  if (!project.gates.hasFrozenPlan || !project.plan) {
    throw new Error("研究计划尚未冻结（hasFrozenPlan=false 或 plan 缺失），无法执行实验与熔断判断");
  }
  if (!project.gates.budgetApproved) {
    throw new Error("预算尚未审批通过（budgetApproved=false），不能触发云端实验");
  }
}

function maxFailedAttempts(project: ResearchProject): number {
  const value = project.plan?.stopRules.maxFailedAttempts;
  if (!value || value < 1) {
    throw new Error("stopRules.maxFailedAttempts 缺失或不合法，无法做熔断判断");
  }
  return value;
}

function applySucceededRun(project: ResearchProject, run: ExperimentRun): ResearchProject {
  const base: ResearchProject = {
    ...project,
    updatedAt: nowIsoTimestamp(),
    latestRunId: run.runId,
    latestRunStatus: run.status,
    failedAttemptCount: 0,
  };

  const gates = { ...base.gates, experimentCompleted: true };
  const step = advanceStep(base.step, "step9_result_validation", gates);
  return { ...base, gates, step, phase: phaseForStep(step) };
}

function applyFailedRun(
  project: ResearchProject,
  run: ExperimentRun,
): {
  readonly next: ResearchProject;
  readonly circuitBreakerTripped: boolean;
} {
  const failedAttemptCount = (project.failedAttemptCount ?? 0) + 1;
  const limit = maxFailedAttempts(project);
  const circuitBreakerTripped = failedAttemptCount >= limit;

  const base: ResearchProject = {
    ...project,
    updatedAt: nowIsoTimestamp(),
    latestRunId: run.runId,
    latestRunStatus: run.status,
    failedAttemptCount,
    lifecycle: circuitBreakerTripped ? "paused" : project.lifecycle,
  };

  return { next: { ...base, phase: phaseForStep(base.step) }, circuitBreakerTripped };
}

export async function recordExperimentRunResult(
  deps: OrchestratorDeps,
  input: { readonly projectId: string; readonly run: ExperimentRun; readonly actorId?: string },
): Promise<ResearchProject> {
  const project = await deps.projects.load(input.projectId);
  requireProjectReady(project);

  if (input.run.projectId !== project.projectId) {
    throw new Error(
      `run.projectId 与 projectId 不一致: run=${input.run.projectId} project=${project.projectId}`,
    );
  }
  if (!isTerminalRunStatus(input.run.status)) {
    throw new Error(`run 尚未结束，不能写回项目状态: status=${input.run.status}`);
  }

  const applied =
    input.run.status === "succeeded"
      ? { next: applySucceededRun(project, input.run), circuitBreakerTripped: false }
      : applyFailedRun(project, input.run);
  const next = applied.next;
  const labelSuffix = applied.circuitBreakerTripped ? "_circuit_breaker" : "";
  const auditAction = applied.circuitBreakerTripped
    ? "experiment.run.circuit_breaker"
    : "experiment.run";
  const outputSuffix = applied.circuitBreakerTripped ? " paused" : "";
  return await checkpointAndSave({
    deps,
    project: next,
    checkpointLabel: `experiment_${input.run.status}${labelSuffix}`,
    auditAction,
    details: {
      input: input.run.experimentId,
      output: `${input.run.runId}:${input.run.status}${outputSuffix}`,
    },
    auditActor: actor(input.actorId ?? "human", "human"),
  });
}
