import { describe, expect, it } from "vitest";
import { getNextResearchStep, isResearchStep, RESEARCH_STEPS } from "./index.ts";

describe("steps contracts", () => {
  it("recognizes research steps and resolves next step", () => {
    expect(isResearchStep("step0_plan_freeze")).toBe(true);
    expect(isResearchStep("nope")).toBe(false);
    expect(getNextResearchStep("step0_plan_freeze")).toBe("step1_literature_crawl");
    expect(getNextResearchStep("step12_human_final")).toBeNull();
    expect(RESEARCH_STEPS[0]).toBe("step0_plan_freeze");
  });
});
