import {
  isAssertionVerified,
  isClaimVerified,
  validateClaim,
  type Claim,
  type ValidationIssue,
} from "@deepscholar/contracts";

export type AssertionStatusCounts = {
  readonly total: number;
  readonly verified: number;
  readonly draft: number;
  readonly disputed: number;
};

export type EvidenceGapCounts = {
  readonly missingValues: number;
  readonly missingBaselineComparison: number;
  readonly missingStatisticalSupport: number;
};

export type ClaimLedgerSummary = {
  readonly totalClaims: number;
  readonly verifiedClaims: number;
  readonly pendingClaims: number;
  readonly disputedClaims: number;
  readonly assertions: AssertionStatusCounts;
  readonly evidenceGaps: EvidenceGapCounts;
  readonly issues: readonly ValidationIssue[];
};

function prefixIssues(claim: Claim, issues: readonly ValidationIssue[]): ValidationIssue[] {
  return issues.map((issue) => ({
    field: `${claim.claimId}.${issue.field}`,
    message: issue.message,
  }));
}

function countAssertionStatuses(claims: readonly Claim[]): AssertionStatusCounts {
  let verified = 0;
  let draft = 0;
  let disputed = 0;
  let total = 0;

  for (const claim of claims) {
    for (const assertion of claim.assertions) {
      total += 1;
      if (assertion.auditStatus === "disputed") {
        disputed += 1;
        continue;
      }
      if (isAssertionVerified(assertion)) {
        verified += 1;
        continue;
      }
      draft += 1;
    }
  }

  return { total, verified, draft, disputed };
}

function countEvidenceGaps(claims: readonly Claim[]): EvidenceGapCounts {
  let missingValues = 0;
  let missingBaselineComparison = 0;
  let missingStatisticalSupport = 0;

  for (const claim of claims) {
    for (const assertion of claim.assertions) {
      if (assertion.evidence.values.length === 0) {
        missingValues += 1;
      }
      if (assertion.type === "comparative" && assertion.evidence.baselineComparison === undefined) {
        missingBaselineComparison += 1;
      }
      if (claim.strength === "strong") {
        const hasCi = assertion.evidence.ci95 !== undefined;
        const hasPValue = assertion.evidence.baselineComparison?.pValue !== undefined;
        if (!hasCi && !hasPValue) {
          missingStatisticalSupport += 1;
        }
      }
    }
  }

  return { missingValues, missingBaselineComparison, missingStatisticalSupport };
}

export function summarizeClaimLedger(claims: readonly Claim[]): ClaimLedgerSummary {
  const issues = claims.flatMap((claim) => prefixIssues(claim, validateClaim(claim)));
  const totalClaims = claims.length;
  const verifiedClaims = claims.filter((claim) => isClaimVerified(claim)).length;
  const disputedClaims = claims.filter((claim) =>
    claim.assertions.some((assertion) => assertion.auditStatus === "disputed"),
  ).length;

  return {
    totalClaims,
    verifiedClaims,
    pendingClaims: totalClaims - verifiedClaims,
    disputedClaims,
    assertions: countAssertionStatuses(claims),
    evidenceGaps: countEvidenceGaps(claims),
    issues,
  };
}
