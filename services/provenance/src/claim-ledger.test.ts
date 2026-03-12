import { createAssertion, createClaim, createEvidenceBinding } from "@deepscholar/contracts";
import { describe, expect, it } from "vitest";
import { summarizeClaimLedger } from "./index.ts";

describe("claim ledger summary", () => {
  it("counts verified and pending claims and reports evidence gaps", () => {
    const claims = [
      createClaim({
        claimId: "c1",
        paperSection: "Table 1",
        content: "verified",
        strength: "strong",
        assertions: [
          createAssertion({
            assertionId: "a1",
            type: "numerical",
            evidence: createEvidenceBinding({
              runGroupId: "g1",
              metricName: "acc",
              values: [0.9],
              seedCount: 3,
            }),
            auditStatus: "verified",
            verifiedBy: "auditor",
            verifiedAt: "2026-03-10T00:00:00.000Z",
          }),
        ],
      }),
      createClaim({
        claimId: "c2",
        paperSection: "2.1",
        content: "pending",
        assertions: [
          createAssertion({
            assertionId: "a2",
            type: "numerical",
            evidence: createEvidenceBinding({
              runGroupId: "g2",
              metricName: "f1",
              values: [0.8],
              seedCount: 1,
            }),
          }),
        ],
      }),
    ];
    expect(summarizeClaimLedger(claims)).toEqual(
      expect.objectContaining({
        totalClaims: 2,
        verifiedClaims: 1,
        pendingClaims: 1,
        disputedClaims: 0,
        assertions: { total: 2, verified: 1, draft: 1, disputed: 0 },
        evidenceGaps: expect.objectContaining({ missingStatisticalSupport: 1 }),
      }),
    );
  });
});
