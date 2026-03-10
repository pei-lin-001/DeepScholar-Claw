import { describe, expect, it } from "vitest";
import { evaluateBudgetGate } from "./index.ts";

describe("budget gate", () => {
  const envelope = { totalUsd: 100, gpuUsd: 70, llmUsd: 30 };
  const usage = { totalUsd: 50, gpuUsd: 20, llmUsd: 10 };

  it("allows small safe requests", () => {
    const decision = evaluateBudgetGate(envelope, usage, {
      totalUsd: 10,
      gpuUsd: 10,
      llmUsd: 0,
      isHighRisk: false,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.requiresApproval).toBe(false);
  });

  it("requires approval for large or high-risk requests", () => {
    const decision = evaluateBudgetGate(envelope, usage, {
      totalUsd: 30,
      gpuUsd: 30,
      llmUsd: 0,
      isHighRisk: true,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.requiresApproval).toBe(true);
    expect(decision.reasons.length).toBeGreaterThan(0);
  });
});
