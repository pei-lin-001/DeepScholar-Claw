import { describe, expect, it } from "vitest";
import {
  collectUnverifiedClaims,
  createAssertion,
  createClaim,
  createEvidenceBinding,
  validateClaim,
} from "./index.ts";

describe("claim contracts", () => {
  it("collects unverified claims", () => {
    const verified = createClaim({
      claimId: "c1",
      paperSection: "3.1",
      content: "ok",
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
    });
    const pending = createClaim({
      claimId: "c2",
      paperSection: "3.2",
      content: "wait",
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
    });
    expect(collectUnverifiedClaims([verified, pending])).toEqual([pending]);
  });

  it("rejects empty claim fields", () => {
    const entry = createClaim({
      claimId: "",
      paperSection: "",
      content: "",
      assertions: [
        createAssertion({
          assertionId: "",
          type: "numerical",
          evidence: createEvidenceBinding({
            runGroupId: "",
            metricName: "",
            values: [],
            seedCount: 0,
          }),
          auditStatus: "verified",
          verifiedBy: "",
          verifiedAt: "not-a-timestamp",
        }),
      ],
    });
    expect(validateClaim(entry).length).toBeGreaterThan(0);
  });
});
