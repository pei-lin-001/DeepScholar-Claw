import { describe, expect, it } from "vitest";
import {
  approveBudgetRequest,
  rejectBudgetRequest,
  validateBudgetApprovalRequest,
} from "./index.ts";

describe("approvals contracts", () => {
  it("requires decision fields when status is approved/rejected", () => {
    const base = {
      requestId: "r1",
      projectId: "p1",
      createdAt: "2026-03-10T00:00:00.000Z",
      requestor: "budget-bot",
      purpose: "GPU hours",
      estimatedCostUsd: 10,
      estimatedDuration: "2h",
      consumedBudgetUsd: 0,
      totalBudgetUsd: 100,
      isHighRisk: false,
      alternatives: [],
      status: "pending" as const,
    };

    const approved = approveBudgetRequest({
      request: base,
      decidedAt: "2026-03-10T00:00:01.000Z",
      decidedBy: "human",
    });
    expect(validateBudgetApprovalRequest(approved)).toEqual([]);

    const rejected = rejectBudgetRequest({
      request: base,
      decidedAt: "2026-03-10T00:00:02.000Z",
      decidedBy: "human",
      comments: "no",
    });
    expect(validateBudgetApprovalRequest(rejected)).toEqual([]);
  });
});
