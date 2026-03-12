import { isNonEmptyText, nowIsoTimestamp, type ResearchProject } from "@deepscholar/contracts";
import { checkpointAndSave, actor, type OrchestratorDeps } from "./orchestrator-internals.ts";
import { advanceStep, phaseForStep } from "./step-machine.ts";

function requireProjectReady(project: ResearchProject): void {
  if (project.step !== "step9_result_validation") {
    throw new Error(`当前步骤不是 step9_result_validation，不能写回结果验证: step=${project.step}`);
  }
  if (!project.gates.experimentCompleted) {
    throw new Error("实验尚未完成（experimentCompleted=false），不能进入结果验证完成态");
  }
}

export async function recordResultsVerified(
  deps: OrchestratorDeps,
  input: { readonly projectId: string; readonly summary: string; readonly actorId?: string },
): Promise<ResearchProject> {
  if (!isNonEmptyText(input.summary)) {
    throw new Error("summary 不能为空");
  }
  const project = await deps.projects.load(input.projectId);
  requireProjectReady(project);

  const base: ResearchProject = { ...project, updatedAt: nowIsoTimestamp() };
  const gates = { ...base.gates, resultsVerified: true };
  const step = advanceStep(base.step, "step10_paper_writing", gates);
  const next: ResearchProject = { ...base, gates, step, phase: phaseForStep(step) };

  return await checkpointAndSave({
    deps,
    project: next,
    checkpointLabel: "results_verified",
    auditAction: "results.verify",
    details: { input: "result_validation", output: input.summary },
    auditActor: actor(input.actorId ?? "human", "human"),
  });
}
