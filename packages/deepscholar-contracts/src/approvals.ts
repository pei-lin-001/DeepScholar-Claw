import { isIsoTimestamp, type IsoTimestamp } from "./time.ts";
import { isNonEmptyText, isOneOf, pushIf, type ValidationIssue } from "./validation.ts";

export type ApprovalStatus = "pending" | "approved" | "rejected";

const APPROVAL_STATUSES: readonly ApprovalStatus[] = ["pending", "approved", "rejected"];

export type BudgetApprovalRequest = {
  readonly requestId: string;
  readonly projectId: string;
  readonly createdAt: IsoTimestamp;
  readonly requestor: string;
  readonly purpose: string;
  readonly estimatedCostUsd: number;
  readonly estimatedDuration: string;
  readonly consumedBudgetUsd: number;
  readonly totalBudgetUsd: number;
  readonly isHighRisk: boolean;
  readonly alternatives: readonly string[];
  readonly status: ApprovalStatus;
  readonly decidedAt?: IsoTimestamp;
  readonly decidedBy?: string;
  readonly comments?: string;
  readonly modifiedBudgetUsd?: number;
};

export function validateBudgetApprovalRequest(req: BudgetApprovalRequest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(req.requestId), "requestId", "requestId 不能为空");
  pushIf(issues, !isNonEmptyText(req.projectId), "projectId", "projectId 不能为空");
  pushIf(issues, !isIsoTimestamp(req.createdAt), "createdAt", "createdAt 必须是合法时间戳");
  pushIf(issues, !isNonEmptyText(req.requestor), "requestor", "requestor 不能为空");
  pushIf(issues, !isNonEmptyText(req.purpose), "purpose", "purpose 不能为空");
  pushIf(
    issues,
    !isOneOf(req.status, APPROVAL_STATUSES),
    "status",
    `审批状态必须是 ${APPROVAL_STATUSES.join("/")}`,
  );
  pushIf(issues, req.estimatedCostUsd < 0, "estimatedCostUsd", "estimatedCostUsd 不能为负数");
  pushIf(
    issues,
    !isNonEmptyText(req.estimatedDuration),
    "estimatedDuration",
    "estimatedDuration 不能为空",
  );
  pushIf(issues, req.consumedBudgetUsd < 0, "consumedBudgetUsd", "consumedBudgetUsd 不能为负数");
  pushIf(issues, req.totalBudgetUsd < 0, "totalBudgetUsd", "totalBudgetUsd 不能为负数");
  pushIf(
    issues,
    req.totalBudgetUsd < req.consumedBudgetUsd,
    "totalBudgetUsd",
    "总预算不能小于已消耗预算",
  );

  if (req.status !== "pending") {
    pushIf(
      issues,
      !isIsoTimestamp(req.decidedAt ?? ""),
      "decidedAt",
      "非 pending 状态必须包含 decidedAt",
    );
    pushIf(
      issues,
      !isNonEmptyText(req.decidedBy ?? ""),
      "decidedBy",
      "非 pending 状态必须包含 decidedBy",
    );
  } else {
    if (req.decidedAt !== undefined) {
      pushIf(issues, !isIsoTimestamp(req.decidedAt), "decidedAt", "decidedAt 必须是合法时间戳");
    }
    if (req.decidedBy !== undefined) {
      pushIf(issues, !isNonEmptyText(req.decidedBy), "decidedBy", "decidedBy 不能为空");
    }
  }

  if (req.modifiedBudgetUsd !== undefined) {
    pushIf(issues, req.modifiedBudgetUsd < 0, "modifiedBudgetUsd", "modifiedBudgetUsd 不能为负数");
  }
  return issues;
}

export function approveBudgetRequest(input: {
  readonly request: BudgetApprovalRequest;
  readonly decidedAt: IsoTimestamp;
  readonly decidedBy: string;
  readonly comments?: string;
  readonly modifiedBudgetUsd?: number;
}): BudgetApprovalRequest {
  if (input.request.status !== "pending") {
    throw new Error(`只能审批 pending 状态的请求，当前状态: ${input.request.status}`);
  }
  return {
    ...input.request,
    status: "approved",
    decidedAt: input.decidedAt,
    decidedBy: input.decidedBy,
    comments: input.comments,
    modifiedBudgetUsd: input.modifiedBudgetUsd,
  };
}

export function rejectBudgetRequest(input: {
  readonly request: BudgetApprovalRequest;
  readonly decidedAt: IsoTimestamp;
  readonly decidedBy: string;
  readonly comments?: string;
}): BudgetApprovalRequest {
  if (input.request.status !== "pending") {
    throw new Error(`只能拒绝 pending 状态的请求，当前状态: ${input.request.status}`);
  }
  return {
    ...input.request,
    status: "rejected",
    decidedAt: input.decidedAt,
    decidedBy: input.decidedBy,
    comments: input.comments,
  };
}
