import { describe, expect, it } from "vitest";
import { createExperimentRun, validateExperimentRun } from "./runs.ts";

describe("run contracts", () => {
  it("creates a minimal run record and validates", () => {
    const run = createExperimentRun({
      runId: "run-1",
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      status: "queued",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
      artifacts: [],
    });
    expect(validateExperimentRun(run)).toEqual([]);
  });

  it("rejects invalid status", () => {
    const run = createExperimentRun({
      runId: "run-1",
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      status: "unknown" as unknown as Parameters<typeof createExperimentRun>[0]["status"],
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:00.000Z",
      artifacts: [],
    });
    expect(validateExperimentRun(run).map((issue) => issue.field)).toContain("status");
  });
});
