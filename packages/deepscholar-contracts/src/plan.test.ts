import { describe, expect, it } from "vitest";
import {
  createExperimentSpec,
  createResearchPlan,
  validateExperimentSpec,
  validateResearchPlan,
} from "./index.ts";

describe("plan contracts", () => {
  it("normalizes repeated datasets and stop rules", () => {
    const plan = createResearchPlan({
      planId: "plan-1",
      projectId: "project-1",
      hypothesis: "Works better",
      successMetric: "accuracy",
      successThreshold: 0.8,
      baselines: [{ name: "base", source: "official" }],
      datasets: ["mnist", "mnist"],
      stopRules: ["budget", "budget"],
    });
    expect(plan.datasets).toEqual(["mnist"]);
    expect(plan.stopRules).toEqual(["budget"]);
    expect(validateResearchPlan(plan)).toEqual([]);
  });

  it("requires datasets and metrics for experiments", () => {
    const spec = createExperimentSpec({
      experimentId: "exp-1",
      projectId: "project-1",
      planId: "plan-1",
      summary: "empty",
      runtimeProfile: "smoke",
      datasets: [],
      metrics: [],
      requiredArtifacts: [],
    });
    expect(validateExperimentSpec(spec)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "datasets" }),
        expect.objectContaining({ field: "metrics" }),
      ]),
    );
  });
});
