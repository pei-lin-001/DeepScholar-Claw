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
});
