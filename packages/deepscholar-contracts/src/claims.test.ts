import { describe, expect, it } from "vitest";
import {
  collectUnverifiedClaims,
  createClaimLedgerEntry,
  validateClaimLedgerEntry,
} from "./index.ts";

describe("claim contracts", () => {
  it("collects unverified claims", () => {
    const verified = createClaimLedgerEntry({
      claimId: "c1",
      section: "3.1",
      statement: "ok",
      metricName: "acc",
      runGroupId: "g1",
      verified: true,
    });
    const pending = createClaimLedgerEntry({
      claimId: "c2",
      section: "3.2",
      statement: "wait",
      metricName: "f1",
      runGroupId: "g2",
    });
    expect(collectUnverifiedClaims([verified, pending])).toEqual([pending]);
  });

  it("rejects empty claim fields", () => {
    const entry = createClaimLedgerEntry({
      claimId: "",
      section: "",
      statement: "",
      metricName: "",
      runGroupId: "",
    });
    expect(validateClaimLedgerEntry(entry).length).toBeGreaterThan(0);
  });
});
