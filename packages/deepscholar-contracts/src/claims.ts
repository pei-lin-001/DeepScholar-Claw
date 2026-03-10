import { isNonEmptyText, pushIf, type ValidationIssue } from "./validation.ts";

export type ClaimAggregation = "mean" | "median" | "best";

export type ClaimLedgerEntry = {
  readonly claimId: string;
  readonly section: string;
  readonly statement: string;
  readonly metricName: string;
  readonly runGroupId: string;
  readonly aggregation: ClaimAggregation;
  readonly verified: boolean;
};

export type CreateClaimLedgerEntryInput = {
  readonly claimId: string;
  readonly section: string;
  readonly statement: string;
  readonly metricName: string;
  readonly runGroupId: string;
  readonly aggregation?: ClaimAggregation;
  readonly verified?: boolean;
};

export function createClaimLedgerEntry(input: CreateClaimLedgerEntryInput): ClaimLedgerEntry {
  return {
    claimId: input.claimId,
    section: input.section,
    statement: input.statement,
    metricName: input.metricName,
    runGroupId: input.runGroupId,
    aggregation: input.aggregation ?? "mean",
    verified: input.verified ?? false,
  };
}

export function validateClaimLedgerEntry(entry: ClaimLedgerEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(entry.claimId), "claimId", "结论编号不能为空");
  pushIf(issues, !isNonEmptyText(entry.section), "section", "结论所在章节不能为空");
  pushIf(issues, !isNonEmptyText(entry.statement), "statement", "结论内容不能为空");
  pushIf(issues, !isNonEmptyText(entry.metricName), "metricName", "指标名称不能为空");
  pushIf(issues, !isNonEmptyText(entry.runGroupId), "runGroupId", "运行组编号不能为空");
  return issues;
}

export function collectUnverifiedClaims(entries: readonly ClaimLedgerEntry[]): ClaimLedgerEntry[] {
  return entries.filter((entry) => !entry.verified);
}
