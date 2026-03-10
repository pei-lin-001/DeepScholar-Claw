import { createClaimLedgerEntry } from "@deepscholar/contracts";
import { describe, expect, it } from "vitest";
import { summarizeClaimLedger } from "./index.ts";

describe("claim ledger summary", () => {
  it("counts verified and pending claims", () => {
    const claims = [
      createClaimLedgerEntry({
        claimId: "c1",
        section: "1",
        statement: "verified",
        metricName: "acc",
        runGroupId: "g1",
        verified: true,
      }),
      createClaimLedgerEntry({
        claimId: "c2",
        section: "2",
        statement: "pending",
        metricName: "f1",
        runGroupId: "g2",
      }),
    ];
    expect(summarizeClaimLedger(claims)).toEqual(
      expect.objectContaining({ total: 2, verified: 1, pending: 1 }),
    );
  });
});
