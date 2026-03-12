import {
  getNextResearchStep,
  type ProjectGateState,
  type ResearchPhase,
  type ResearchStep,
} from "@deepscholar/contracts";

export type StepGateContext = ProjectGateState;

export type StepTransitionDecision = {
  readonly allowed: boolean;
  readonly reasons: readonly string[];
};

export function createEmptyGateContext(): StepGateContext {
  return {
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
  };
}

export function phaseForStep(step: ResearchStep): ResearchPhase {
  if (step === "step0_plan_freeze") {
    return "plan";
  }
  if (step === "step1_literature_crawl" || step === "step2_graph_build") {
    return "literature";
  }
  if (
    step === "step3_novelty_discovery" ||
    step === "step4_internal_workshop" ||
    step === "step5_human_topic_select"
  ) {
    return "proposal";
  }
  if (
    step === "step6_experiment_design" ||
    step === "step7_resource_approval" ||
    step === "step8_cloud_experiment"
  ) {
    return "experiment";
  }
  if (step === "step9_result_validation") {
    return "validation";
  }
  if (step === "step10_paper_writing") {
    return "writing";
  }
  if (step === "step11_peer_review") {
    return "review";
  }
  return "handoff";
}

function reasonsForNextStep(next: ResearchStep, ctx: StepGateContext): string[] {
  const reasons: string[] = [];
  if (next === "step1_literature_crawl" && !ctx.hasFrozenPlan) {
    reasons.push("研究计划尚未冻结，不能进入文献爬取");
  }
  if (next === "step2_graph_build" && !ctx.literatureIngested) {
    reasons.push("文献尚未入库，不能构建知识图谱");
  }
  if (next === "step3_novelty_discovery" && !ctx.graphBuilt) {
    reasons.push("知识图谱尚未构建，不能做创新点发现");
  }
  if (next === "step4_internal_workshop" && !ctx.proposalsReady) {
    reasons.push("候选提案尚未形成，不能进入内部研讨");
  }
  if (next === "step5_human_topic_select" && !ctx.proposalsReady) {
    reasons.push("候选提案尚未形成，不能发起人类选题");
  }
  if (next === "step6_experiment_design" && !ctx.approvedProposal) {
    reasons.push("尚未有人类选题/批准提案，不能进入实验设计");
  }
  if (next === "step7_resource_approval" && !ctx.experimentDesigned) {
    reasons.push("实验尚未设计完成，不能发起资源审批");
  }
  if (next === "step8_cloud_experiment" && !ctx.budgetApproved) {
    reasons.push("预算尚未审批通过，不能触发云端实验");
  }
  if (next === "step9_result_validation" && !ctx.experimentCompleted) {
    reasons.push("实验尚未完成，不能进入结果验证");
  }
  if (next === "step10_paper_writing" && !ctx.resultsVerified) {
    reasons.push("结果尚未被审计验证，不能进入论文撰写");
  }
  if (next === "step11_peer_review" && !ctx.draftWritten) {
    reasons.push("论文草稿尚未完成，不能进入模拟同行评审");
  }
  if (next === "step12_human_final" && !ctx.reviewCompleted) {
    reasons.push("模拟评审尚未完成，不能进入人类终审");
  }
  return reasons;
}

export function canAdvanceStep(current: ResearchStep, next: ResearchStep): boolean {
  if (current === next) {
    return false;
  }
  return getNextResearchStep(current) === next;
}

export function evaluateStepTransition(
  current: ResearchStep,
  next: ResearchStep,
  ctx: StepGateContext,
): StepTransitionDecision {
  if (!canAdvanceStep(current, next)) {
    return { allowed: false, reasons: [`非法步骤跳转: ${current} -> ${next}`] };
  }
  const reasons = reasonsForNextStep(next, ctx);
  return { allowed: reasons.length === 0, reasons };
}

export function advanceStep(
  current: ResearchStep,
  next: ResearchStep,
  ctx: StepGateContext,
): ResearchStep {
  const decision = evaluateStepTransition(current, next, ctx);
  if (!decision.allowed) {
    throw new Error(decision.reasons.join("; "));
  }
  return next;
}
