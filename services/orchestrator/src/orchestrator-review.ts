import {
  REVIEW_VERDICTS,
  isNonEmptyText,
  nowIsoTimestamp,
  validateReviewDecision,
  type ResearchProject,
  type ReviewDecision,
} from "@deepscholar/contracts";
import { checkpointAndSave, actor, type OrchestratorDeps } from "./orchestrator-internals.ts";
import { advanceStep, phaseForStep } from "./step-machine.ts";

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

function applyDebateHold(project: ResearchProject): ResearchProject {
  // Debate is a sub-flow inside Step11: keep the project at peer review and
  // require an explicit human resolution before moving to Step12.
  return {
    ...project,
    lifecycle: "paused",
    gates: { ...project.gates, reviewCompleted: false },
    step: "step11_peer_review",
    phase: phaseForStep("step11_peer_review"),
  };
}

function requireDebateResolutionInput(
  input: Pick<
    Parameters<typeof resolvePeerReviewDebate>[1],
    "verdict" | "summary" | "draftId"
  >,
): void {
  if (!(REVIEW_VERDICTS as readonly string[]).includes(input.verdict)) {
    throw new Error(`verdict 必须是 ${REVIEW_VERDICTS.join("/")}`);
  }
  if (!isNonEmptyText(input.summary)) {
    throw new Error("summary 不能为空");
  }
  if (input.draftId !== undefined && !isNonEmptyText(input.draftId)) {
    throw new Error("draftId 不能为空");
  }
}

function requireDecisionMatchesProject(
  project: ResearchProject,
  decision: ReviewDecision,
): void {
  const decisionIssues = validateReviewDecision(decision);
  if (decisionIssues.length > 0) {
    throw new Error(
      `ReviewDecision 校验失败: ${decisionIssues.map((i) => `${i.field}:${i.message}`).join(", ")}`,
    );
  }
  if (decision.projectId !== project.projectId) {
    throw new Error("ReviewDecision.projectId 与当前项目不一致");
  }
  if (!isNonEmptyText(decision.draftId)) {
    throw new Error("ReviewDecision.draftId 不能为空");
  }
}

type ReviewDecisionTransition = {
  readonly project: ResearchProject;
  readonly checkpointLabel: string;
  readonly auditAction: string;
  readonly output: string;
  readonly input: string;
};

function buildReviewDecisionTransition(
  project: ResearchProject,
  decision: ReviewDecision,
): ReviewDecisionTransition {
  const base: ResearchProject = { ...project, updatedAt: nowIsoTimestamp() };
  const verdict = decision.verdict;
  const next =
    verdict === "major_revision"
      ? applyMajorRevision(base)
      : decision.debateTriggered
        ? applyDebateHold(base)
        : applyFinalDecision(base);
  return {
    project: next,
    checkpointLabel:
      verdict === "major_revision"
        ? "review_major_revision"
        : decision.debateTriggered
          ? "review_debate_triggered"
          : `review_${verdict}`,
    auditAction:
      verdict === "major_revision"
        ? "review.decision.major_revision"
        : decision.debateTriggered
          ? "review.debate.triggered"
          : "review.decision",
    output:
      verdict === "major_revision"
        ? "back_to_step10"
        : decision.debateTriggered
          ? "hold_for_debate"
          : "advance_to_step12",
    input: `${verdict}:${decision.averageScore.toFixed(2)}`,
  };
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
  requireDecisionMatchesProject(project, input.decision);
  const transition = buildReviewDecisionTransition(project, input.decision);

  return await checkpointAndSave({
    deps,
    project: transition.project,
    checkpointLabel: transition.checkpointLabel,
    auditAction: transition.auditAction,
    details: { input: transition.input, output: transition.output },
    auditActor: actor(input.actorId ?? "human", "human"),
  });
}

function buildDebateResolution(
  project: ResearchProject,
  verdict: ReviewDecision["verdict"],
): ReviewDecisionTransition {
  const base: ResearchProject = { ...project, updatedAt: nowIsoTimestamp() };
  const next = verdict === "major_revision" ? applyMajorRevision(base) : applyFinalDecision(base);
  const shouldUnpause =
    next.pendingApprovalRequestIds.length === 0 && next.lifecycle === "paused";
  const lifecycle = shouldUnpause ? "active" : next.lifecycle;
  return {
    project: { ...next, lifecycle },
    checkpointLabel:
      verdict === "major_revision" ? "debate_major_revision" : `debate_${verdict}`,
    auditAction: "review.debate.resolve",
    output: verdict === "major_revision" ? "back_to_step10" : "advance_to_step12",
    input: verdict,
  };
}

export async function resolvePeerReviewDebate(
  deps: OrchestratorDeps,
  input: {
    readonly projectId: string;
    readonly verdict: ReviewDecision["verdict"];
    readonly summary: string;
    readonly draftId?: string;
    readonly actorId?: string;
  },
): Promise<ResearchProject> {
  requireDebateResolutionInput(input);
  const project = await deps.projects.load(input.projectId);
  requireProjectReady(project);
  if (project.gates.reviewCompleted) {
    throw new Error("评审已完成（reviewCompleted=true），无需 debate resolve");
  }
  if (project.lifecycle !== "paused") {
    throw new Error(`项目未处于 paused，不能 debate resolve: lifecycle=${project.lifecycle}`);
  }

  const transition = buildDebateResolution(project, input.verdict);

  return await checkpointAndSave({
    deps,
    project: transition.project,
    checkpointLabel: transition.checkpointLabel,
    auditAction: transition.auditAction,
    details: {
      input: `${transition.input}:${input.draftId ?? "(draft-unknown)"}:${input.summary}`,
      output: transition.output,
    },
    auditActor: actor(input.actorId ?? "human", "human"),
  });
}
