import type { BudgetEnvelope } from "@deepscholar/contracts";

export type BudgetUsage = {
  readonly totalUsd: number;
  readonly gpuUsd: number;
  readonly llmUsd: number;
};

export type BudgetRequest = {
  readonly totalUsd: number;
  readonly gpuUsd: number;
  readonly llmUsd: number;
  readonly isHighRisk: boolean;
};

export type BudgetDecision = {
  readonly allowed: boolean;
  readonly requiresApproval: boolean;
  readonly reasons: readonly string[];
};

const APPROVAL_THRESHOLD = 0.2;

export function evaluateBudgetGate(
  envelope: BudgetEnvelope,
  usage: BudgetUsage,
  request: BudgetRequest,
): BudgetDecision {
  const reasons: string[] = [];
  const projectedTotal = usage.totalUsd + request.totalUsd;
  const overBudget = projectedTotal > envelope.totalUsd;
  const largeRequest = request.totalUsd > envelope.totalUsd * APPROVAL_THRESHOLD;
  if (overBudget) {
    reasons.push("本次申请会让项目超出总预算");
  }
  if (largeRequest) {
    reasons.push("本次申请已经超过项目总预算的 20%");
  }
  if (request.isHighRisk) {
    reasons.push("本次申请属于高风险资源动作");
  }
  return {
    allowed: !overBudget,
    requiresApproval: largeRequest || request.isHighRisk,
    reasons,
  };
}
