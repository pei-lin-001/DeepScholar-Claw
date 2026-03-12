import { isIsoTimestamp, type IsoTimestamp } from "./time.ts";
import {
  isFiniteNumber,
  isNonEmptyText,
  isOneOf,
  pushIf,
  type ValidationIssue,
} from "./validation.ts";

export type ClaimStrength = "strong" | "moderate" | "weak";
export type AssertionType = "numerical" | "comparative" | "qualitative";
export type ClaimAuditStatus = "draft" | "verified" | "disputed";
export type ClaimAggregation = "mean" | "median" | "best";

const CLAIM_STRENGTHS: readonly ClaimStrength[] = ["strong", "moderate", "weak"];
const ASSERTION_TYPES: readonly AssertionType[] = ["numerical", "comparative", "qualitative"];
const CLAIM_AUDIT_STATUSES: readonly ClaimAuditStatus[] = ["draft", "verified", "disputed"];
const CLAIM_AGGREGATIONS: readonly ClaimAggregation[] = ["mean", "median", "best"];

export type BaselineComparison = {
  readonly baselineRunGroupId: string;
  readonly delta: number;
  readonly pValue?: number;
};

export type EvidenceBinding = {
  readonly runGroupId: string;
  readonly metricName: string;
  readonly values: readonly number[];
  readonly aggregation: ClaimAggregation;
  readonly std?: number;
  readonly ci95?: readonly [number, number];
  readonly seedCount: number;
  readonly baselineComparison?: BaselineComparison;
};

export type Assertion = {
  readonly assertionId: string;
  readonly type: AssertionType;
  readonly evidence: EvidenceBinding;
  readonly figureSpecId?: string;
  readonly auditStatus: ClaimAuditStatus;
  readonly verifiedBy?: string;
  readonly verifiedAt?: IsoTimestamp;
};

export type Claim = {
  readonly claimId: string;
  readonly paperSection: string;
  readonly content: string;
  readonly strength: ClaimStrength;
  readonly assertions: readonly Assertion[];
};

export type CreateEvidenceBindingInput = {
  readonly runGroupId: string;
  readonly metricName: string;
  readonly values: readonly number[];
  readonly aggregation?: ClaimAggregation;
  readonly std?: number;
  readonly ci95?: readonly [number, number];
  readonly seedCount: number;
  readonly baselineComparison?: BaselineComparison;
};

export type CreateAssertionInput = {
  readonly assertionId: string;
  readonly type: AssertionType;
  readonly evidence: EvidenceBinding;
  readonly figureSpecId?: string;
  readonly auditStatus?: ClaimAuditStatus;
  readonly verifiedBy?: string;
  readonly verifiedAt?: IsoTimestamp;
};

export type CreateClaimInput = {
  readonly claimId: string;
  readonly paperSection: string;
  readonly content: string;
  readonly strength?: ClaimStrength;
  readonly assertions: readonly Assertion[];
};

const DEFAULT_AGGREGATION: ClaimAggregation = "mean";
const MIN_SEED_COUNT = 1;
const PVALUE_MIN = 0;
const PVALUE_MAX = 1;

export function createEvidenceBinding(input: CreateEvidenceBindingInput): EvidenceBinding {
  return {
    runGroupId: input.runGroupId,
    metricName: input.metricName,
    values: input.values,
    aggregation: input.aggregation ?? DEFAULT_AGGREGATION,
    std: input.std,
    ci95: input.ci95,
    seedCount: input.seedCount,
    baselineComparison: input.baselineComparison,
  };
}

export function createAssertion(input: CreateAssertionInput): Assertion {
  return {
    assertionId: input.assertionId,
    type: input.type,
    evidence: input.evidence,
    figureSpecId: input.figureSpecId,
    auditStatus: input.auditStatus ?? "draft",
    verifiedBy: input.verifiedBy,
    verifiedAt: input.verifiedAt,
  };
}

export function createClaim(input: CreateClaimInput): Claim {
  return {
    claimId: input.claimId,
    paperSection: input.paperSection,
    content: input.content,
    strength: input.strength ?? "moderate",
    assertions: input.assertions,
  };
}

function validateBaselineComparison(comparison: BaselineComparison): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(
    issues,
    !isNonEmptyText(comparison.baselineRunGroupId),
    "baselineComparison.baselineRunGroupId",
    "baseline 运行组不能为空",
  );
  pushIf(
    issues,
    !isFiniteNumber(comparison.delta),
    "baselineComparison.delta",
    "差值(delta)必须是有限数字",
  );
  if (comparison.pValue !== undefined) {
    pushIf(
      issues,
      !isFiniteNumber(comparison.pValue) ||
        comparison.pValue < PVALUE_MIN ||
        comparison.pValue > PVALUE_MAX,
      "baselineComparison.pValue",
      "pValue 必须在 [0, 1] 范围内",
    );
  }
  return issues;
}

export function validateEvidenceBinding(evidence: EvidenceBinding): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(evidence.runGroupId), "evidence.runGroupId", "运行组编号不能为空");
  pushIf(issues, !isNonEmptyText(evidence.metricName), "evidence.metricName", "指标名称不能为空");
  pushIf(
    issues,
    !isOneOf(evidence.aggregation, CLAIM_AGGREGATIONS),
    "evidence.aggregation",
    `聚合方式必须是 ${CLAIM_AGGREGATIONS.join("/")}`,
  );
  pushIf(issues, evidence.values.length === 0, "evidence.values", "证据数值(values)不能为空");
  for (const value of evidence.values) {
    pushIf(issues, !isFiniteNumber(value), "evidence.values", "证据数值(values)必须是有限数字");
  }
  pushIf(
    issues,
    evidence.seedCount < MIN_SEED_COUNT,
    "evidence.seedCount",
    "实验种子数(seedCount)至少为 1",
  );
  if (evidence.std !== undefined) {
    pushIf(
      issues,
      !isFiniteNumber(evidence.std) || evidence.std < 0,
      "evidence.std",
      "标准差(std)必须是非负数",
    );
  }
  if (evidence.ci95 !== undefined) {
    const [low, high] = evidence.ci95;
    pushIf(
      issues,
      !isFiniteNumber(low) || !isFiniteNumber(high),
      "evidence.ci95",
      "置信区间必须是有限数字",
    );
    pushIf(issues, low > high, "evidence.ci95", "置信区间下界不能大于上界");
  }
  if (evidence.baselineComparison !== undefined) {
    issues.push(...validateBaselineComparison(evidence.baselineComparison));
  }
  return issues;
}

export function validateAssertion(assertion: Assertion): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(assertion.assertionId), "assertionId", "断言编号不能为空");
  pushIf(
    issues,
    !isOneOf(assertion.type, ASSERTION_TYPES),
    "type",
    `断言类型必须是 ${ASSERTION_TYPES.join("/")}`,
  );
  pushIf(
    issues,
    !isOneOf(assertion.auditStatus, CLAIM_AUDIT_STATUSES),
    "auditStatus",
    `审计状态必须是 ${CLAIM_AUDIT_STATUSES.join("/")}`,
  );
  issues.push(...validateEvidenceBinding(assertion.evidence));

  if (assertion.type === "comparative") {
    pushIf(
      issues,
      assertion.evidence.baselineComparison === undefined,
      "evidence.baselineComparison",
      "对比型断言必须绑定 baselineComparison",
    );
  }

  if (assertion.auditStatus === "verified") {
    pushIf(
      issues,
      !isNonEmptyText(assertion.verifiedBy ?? ""),
      "verifiedBy",
      "已验证(verified)的断言必须有签名人",
    );
    pushIf(
      issues,
      !isIsoTimestamp(assertion.verifiedAt ?? ""),
      "verifiedAt",
      "已验证(verified)的断言必须有签名时间",
    );
  } else {
    if (assertion.verifiedBy !== undefined) {
      pushIf(issues, !isNonEmptyText(assertion.verifiedBy), "verifiedBy", "签名人不能为空");
    }
    if (assertion.verifiedAt !== undefined) {
      pushIf(
        issues,
        !isIsoTimestamp(assertion.verifiedAt),
        "verifiedAt",
        "签名时间必须是合法时间戳",
      );
    }
  }
  return issues;
}

export function validateClaim(claim: Claim): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(claim.claimId), "claimId", "结论编号不能为空");
  pushIf(issues, !isNonEmptyText(claim.paperSection), "paperSection", "论文位置不能为空");
  pushIf(issues, !isNonEmptyText(claim.content), "content", "结论内容不能为空");
  pushIf(
    issues,
    !isOneOf(claim.strength, CLAIM_STRENGTHS),
    "strength",
    `结论强度必须是 ${CLAIM_STRENGTHS.join("/")}`,
  );
  pushIf(issues, claim.assertions.length === 0, "assertions", "结论必须至少包含一个断言");
  for (const assertion of claim.assertions) {
    issues.push(...validateAssertion(assertion));
  }
  return issues;
}

export function isAssertionVerified(assertion: Assertion): boolean {
  return assertion.auditStatus === "verified";
}

export function isClaimVerified(claim: Claim): boolean {
  return claim.assertions.every((assertion) => isAssertionVerified(assertion));
}

export function collectUnverifiedClaims(claims: readonly Claim[]): Claim[] {
  return claims.filter((claim) => !isClaimVerified(claim));
}
