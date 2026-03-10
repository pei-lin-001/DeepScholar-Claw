import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFsBudgetApprovalStore } from "./budget-approvals-store-fs.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-orch-approvals-"));
}

describe("budget approval store (fs)", () => {
  it("creates, lists, approves, and rejects requests", async () => {
    const homeDir = await createTempDir();
    const store = createFsBudgetApprovalStore({ homeDir });

    const req = await store.create({
      projectId: "p1",
      requestor: "budget-bot",
      purpose: "Run GPU",
      estimatedCostUsd: 10,
      estimatedDuration: "2h",
      consumedBudgetUsd: 0,
      totalBudgetUsd: 100,
      isHighRisk: false,
      alternatives: ["smoke test"],
    });

    expect(req.status).toBe("pending");
    expect(await store.list("p1", "pending")).toHaveLength(1);

    const approved = await store.approve("p1", req.requestId, "human", "ok");
    expect(approved.status).toBe("approved");
    expect(await store.list("p1", "pending")).toHaveLength(0);

    const req2 = await store.create({
      projectId: "p1",
      requestor: "budget-bot",
      purpose: "Run again",
      estimatedCostUsd: 20,
      estimatedDuration: "1h",
      consumedBudgetUsd: 10,
      totalBudgetUsd: 100,
      isHighRisk: true,
      alternatives: [],
    });

    const rejected = await store.reject("p1", req2.requestId, "human", "no");
    expect(rejected.status).toBe("rejected");
    expect(await store.list("p1")).toHaveLength(2);
  });

  it("surfaces validation errors", async () => {
    const store = createFsBudgetApprovalStore({ homeDir: await createTempDir() });
    await expect(
      store.create({
        projectId: "p1",
        requestor: "budget-bot",
        purpose: "bad",
        estimatedCostUsd: -1,
        estimatedDuration: "1h",
        consumedBudgetUsd: 0,
        totalBudgetUsd: 100,
        isHighRisk: false,
        alternatives: [],
      }),
    ).rejects.toThrow(/校验失败/);
  });
});
