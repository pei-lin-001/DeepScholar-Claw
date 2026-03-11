import {
  nowIsoTimestamp,
  validateReviewDecision,
  type ResearchProject,
  type ReviewDecision,
} from "@deepscholar/contracts";
import { checkpointAndSave, actor, type OrchestratorDeps } from "./orchestrator-internals.ts";
import { advanceStep, phaseForStep } from "./step-machine.ts";

function isNonEmptyText(value: string): boolean {
  return value.trim().length > 0;
}

function requireProjectReady(project: ResearchProject): void {
  if (project.step !== "step11_peer_review") {
    throw new Error(`当前步骤不是 step11_peer_review，不能写回评审裁决: step=${project.step}`);
  }
  if (!project.gates.draftWritten) {
    throw new Error("草稿尚未完成（draftWritten=false），不能写回评审结果");
  }
}

function applyMajorRevision(project: ResearchProject): ResearchProject {
  const gates = { ...project.gates, draftWritten: false, reviewCompleted: false };
  return {
    ...project,
    gates,
    step: "step10_paper_writing",
    phase: phaseForStep("step10_paper_writing"),
  };
}

function applyFinalDecision(project: ResearchProject): ResearchProject {
  const gates = { ...project.gates, reviewCompleted: true };
  const step = advanceStep(project.step, "step12_human_final", gates);
  return { ...project, gates, step, phase: phaseForStep(step) };
}

export async function recordPeerReviewDecision(
  deps: OrchestratorDeps,
  input: {
    readonly projectId: string;
    readonly decision: ReviewDecision;
    readonly actorId?: string;
  },
): Promise<ResearchProject> {
  const project = await deps.projects.load(input.projectId);
  requireProjectReady(project);
  const decisionIssues = validateReviewDecision(input.decision);
  if (decisionIssues.length > 0) {
    throw new Error(
      `ReviewDecision 校验失败: ${decisionIssues.map((i) => `${i.field}:${i.message}`).join(", ")}`,
    );
  }
  if (input.decision.projectId !== project.projectId) {
    throw new Error("ReviewDecision.projectId 与当前项目不一致");
  }
  if (!isNonEmptyText(input.decision.draftId)) {
    throw new Error("ReviewDecision.draftId 不能为空");
  }

  const base: ResearchProject = { ...project, updatedAt: nowIsoTimestamp() };
  const verdict = input.decision.verdict;
  const next = verdict === "major_revision" ? applyMajorRevision(base) : applyFinalDecision(base);
  const checkpointLabel =
    verdict === "major_revision" ? "review_major_revision" : `review_${verdict}`;
  const auditAction =
    verdict === "major_revision" ? "review.decision.major_revision" : "review.decision";
  const output = verdict === "major_revision" ? "back_to_step10" : "advance_to_step12";

  return await checkpointAndSave({
    deps,
    project: next,
    checkpointLabel,
    auditAction,
    details: { input: `${verdict}:${input.decision.averageScore.toFixed(2)}`, output },
    auditActor: actor(input.actorId ?? "human", "human"),
  });
}
