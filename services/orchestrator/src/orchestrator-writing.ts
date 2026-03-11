import { isNonEmptyText, nowIsoTimestamp, type ResearchProject } from "@deepscholar/contracts";
import { checkpointAndSave, actor, type OrchestratorDeps } from "./orchestrator-internals.ts";
import { advanceStep, phaseForStep } from "./step-machine.ts";

function requireProjectReady(project: ResearchProject): void {
  if (project.step !== "step10_paper_writing") {
    throw new Error(`当前步骤不是 step10_paper_writing，不能写回草稿完成: step=${project.step}`);
  }
  if (!project.gates.resultsVerified) {
    throw new Error("结果尚未验证（resultsVerified=false），不能标记 draftWritten");
  }
}

export async function recordDraftWritten(
  deps: OrchestratorDeps,
  input: { readonly projectId: string; readonly draftId: string; readonly actorId?: string },
): Promise<ResearchProject> {
  if (!isNonEmptyText(input.draftId)) {
    throw new Error("draftId 不能为空");
  }
  const project = await deps.projects.load(input.projectId);
  requireProjectReady(project);

  const base: ResearchProject = { ...project, updatedAt: nowIsoTimestamp() };
  const gates = { ...base.gates, draftWritten: true };
  const step = advanceStep(base.step, "step11_peer_review", gates);
  const next: ResearchProject = { ...base, gates, step, phase: phaseForStep(step) };

  return await checkpointAndSave({
    deps,
    project: next,
    checkpointLabel: "draft_written",
    auditAction: "paper.draft.written",
    details: { input: input.draftId, output: "ready_for_review" },
    auditActor: actor(input.actorId ?? "human", "human"),
  });
}
