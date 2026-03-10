import type { ResearchPhase } from "./phases.ts";
import type { ResearchPlan } from "./plan.ts";
import type { ResearchStep } from "./steps.ts";
import { isIsoTimestamp, type IsoTimestamp } from "./time.ts";
import { isNonEmptyText, pushIf, type ValidationIssue } from "./validation.ts";

export type IdeaProposal = {
  readonly proposalId: string;
  readonly title: string;
  readonly motivation: string;
  readonly approach: string;
  readonly expectedContribution: string;
  readonly feasibilityScore: number;
  readonly noveltyScore: number;
  readonly supportingPaperIds: readonly string[];
  readonly risks: readonly string[];
};

export type ProjectLifecycleStatus = "active" | "paused" | "aborted" | "completed";

export type ProjectGateState = {
  readonly hasFrozenPlan: boolean;
  readonly literatureIngested: boolean;
  readonly graphBuilt: boolean;
  readonly proposalsReady: boolean;
  readonly approvedProposal: boolean;
  readonly experimentDesigned: boolean;
  readonly budgetApproved: boolean;
  readonly experimentCompleted: boolean;
  readonly resultsVerified: boolean;
  readonly draftWritten: boolean;
  readonly reviewCompleted: boolean;
};

export type ResearchProject = {
  readonly projectId: string;
  readonly title: string;
  readonly topic: string;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly lifecycle: ProjectLifecycleStatus;
  readonly phase: ResearchPhase;
  readonly step: ResearchStep;
  readonly gates: ProjectGateState;
  readonly plan?: ResearchPlan;
  readonly proposals: readonly IdeaProposal[];
  readonly approvedProposalId?: string;
  readonly pendingApprovalRequestIds: readonly string[];
};

export function validateIdeaProposal(proposal: IdeaProposal): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(proposal.proposalId), "proposalId", "proposalId 不能为空");
  pushIf(issues, !isNonEmptyText(proposal.title), "title", "提案标题不能为空");
  pushIf(issues, !isNonEmptyText(proposal.motivation), "motivation", "motivation 不能为空");
  pushIf(issues, !isNonEmptyText(proposal.approach), "approach", "approach 不能为空");
  pushIf(
    issues,
    !isNonEmptyText(proposal.expectedContribution),
    "expectedContribution",
    "expectedContribution 不能为空",
  );
  pushIf(
    issues,
    proposal.feasibilityScore < 1 || proposal.feasibilityScore > 10,
    "feasibilityScore",
    "feasibilityScore 必须在 1-10 范围内",
  );
  pushIf(
    issues,
    proposal.noveltyScore < 1 || proposal.noveltyScore > 10,
    "noveltyScore",
    "noveltyScore 必须在 1-10 范围内",
  );
  return issues;
}

export function validateResearchProject(project: ResearchProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(project.projectId), "projectId", "projectId 不能为空");
  pushIf(issues, !isNonEmptyText(project.title), "title", "title 不能为空");
  pushIf(issues, !isNonEmptyText(project.topic), "topic", "topic 不能为空");
  pushIf(issues, !isIsoTimestamp(project.createdAt), "createdAt", "createdAt 必须是合法时间戳");
  pushIf(issues, !isIsoTimestamp(project.updatedAt), "updatedAt", "updatedAt 必须是合法时间戳");
  for (const proposal of project.proposals) {
    issues.push(...validateIdeaProposal(proposal));
  }
  return issues;
}

export function createResearchProject(input: {
  readonly projectId: string;
  readonly title: string;
  readonly topic: string;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly lifecycle?: ProjectLifecycleStatus;
  readonly phase: ResearchPhase;
  readonly step: ResearchStep;
}): ResearchProject {
  return {
    projectId: input.projectId,
    title: input.title,
    topic: input.topic,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    lifecycle: input.lifecycle ?? "active",
    phase: input.phase,
    step: input.step,
    gates: {
      hasFrozenPlan: false,
      literatureIngested: false,
      graphBuilt: false,
      proposalsReady: false,
      approvedProposal: false,
      experimentDesigned: false,
      budgetApproved: false,
      experimentCompleted: false,
      resultsVerified: false,
      draftWritten: false,
      reviewCompleted: false,
    },
    plan: undefined,
    proposals: [],
    approvedProposalId: undefined,
    pendingApprovalRequestIds: [],
  };
}
