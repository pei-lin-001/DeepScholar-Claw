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
  if (!project.gates.budgetApproved) {
    throw new Error("预算尚未审批通过（budgetApproved=false），不能触发云端实验");
  }
}

function applyRunResult(project: ResearchProject, run: ExperimentRun): ResearchProject {
  const base: ResearchProject = {
    ...project,
    updatedAt: nowIsoTimestamp(),
    latestRunId: run.runId,
    latestRunStatus: run.status,
  };

  if (run.status !== "succeeded") {
    return { ...base, phase: phaseForStep(base.step) };
  }

  const gates = { ...base.gates, experimentCompleted: true };
  const step = advanceStep(base.step, "step9_result_validation", gates);
  return { ...base, gates, step, phase: phaseForStep(step) };
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

  const next = applyRunResult(project, input.run);
  return await checkpointAndSave({
    deps,
    project: next,
    checkpointLabel: `experiment_${input.run.status}`,
    auditAction: "experiment.run",
    details: { input: input.run.experimentId, output: `${input.run.runId}:${input.run.status}` },
    auditActor: actor(input.actorId ?? "human", "human"),
  });
}
