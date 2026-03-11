import { describe, expect, it } from "vitest";
import { createResearchProject, validateResearchProject } from "./index.ts";

describe("project contracts", () => {
  it("creates a minimal project and validates timestamps", () => {
    const project = createResearchProject({
      projectId: "p1",
      title: "Demo",
      topic: "graph rag",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:01.000Z",
      phase: "charter",
      step: "step0_plan_freeze",
    });
    expect(validateResearchProject(project)).toEqual([]);
  });

  it("validates latestRun fields when present", () => {
    const base = createResearchProject({
      projectId: "p1",
      title: "Demo",
      topic: "graph rag",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:01.000Z",
      phase: "charter",
      step: "step0_plan_freeze",
    });

    expect(
      validateResearchProject({ ...base, latestRunId: "run-1", latestRunStatus: "succeeded" }),
    ).toEqual([]);

    const issues = validateResearchProject({ ...base, latestRunStatus: "nope" as never });
    expect(issues.map((issue) => issue.field)).toContain("latestRunStatus");
  });
});
