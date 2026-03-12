import { describe, expect, it } from "vitest";
import {
  createExperimentSpec,
  createResearchPlanDraft,
  freezeResearchPlan,
  validateExperimentSpec,
  validateResearchPlan,
  validateResearchPlanDraft,
} from "./index.ts";

describe("plan contracts", () => {
  it("normalizes evaluation metrics and validates draft plan", () => {
    const draft = createResearchPlanDraft({
      planId: "plan-1",
      projectId: "project-1",
      hypothesis: "Works better",
      successCriteria: {
        primaryMetric: "accuracy",
        targetValue: 0.85,
        improvementOverBaseline: 0.05,
      },
      baselines: [
        {
          name: "baseline",
          source: "official",
          metricValues: { accuracy: 0.8 },
        },
      ],
      datasets: [{ name: "mnist", version: "1.0", split: "train" }],
      evaluationMetrics: ["accuracy", "accuracy"],
      budgetEnvelope: { maxGpuHours: 0, maxCostUsd: 0, maxExperiments: 1 },
      stopRules: { maxFailedAttempts: 1, budgetDepletionPercent: 80, timeLimitHours: 12 },
    });

    expect(draft.evaluationMetrics).toEqual(["accuracy"]);
    expect(validateResearchPlanDraft(draft)).toEqual([]);

    const frozen = freezeResearchPlan({
      draft,
      frozenAt: "2026-03-10T00:00:00.000Z",
      approval: { approvedBy: "human", approvedAt: "2026-03-10T00:00:01.000Z" },
    });
    expect(validateResearchPlan(frozen)).toEqual([]);
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
