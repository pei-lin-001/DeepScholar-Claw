import { describe, expect, it } from "vitest";
import { createProjectCharter, validateProjectCharter } from "./index.ts";

describe("project charter contracts", () => {
  it("builds a default charter with owner roles", () => {
    const charter = createProjectCharter({
      projectId: "p1",
      title: "Demo",
      scope: "Scope",
    });
    expect(charter.ownerRoles.length).toBeGreaterThan(0);
    expect(validateProjectCharter(charter)).toEqual([]);
  });

  it("rejects envelopes whose total is smaller than sub-budgets", () => {
    const charter = createProjectCharter({
      projectId: "p1",
      title: "Demo",
      scope: "Scope",
      budgetEnvelope: { totalUsd: 10, gpuUsd: 8, llmUsd: 5 },
    });
    expect(validateProjectCharter(charter)).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: "budgetEnvelope" })]),
    );
  });
});
