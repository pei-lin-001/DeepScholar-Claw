import { describe, expect, it } from "vitest";
import {
  advanceStep,
  createEmptyGateContext,
  evaluateStepTransition,
  phaseForStep,
} from "./step-machine.ts";

describe("step machine", () => {
  it("maps steps into coarse phases", () => {
    expect(phaseForStep("step0_plan_freeze")).toBe("plan");
    expect(phaseForStep("step2_graph_build")).toBe("literature");
    expect(phaseForStep("step11_peer_review")).toBe("review");
    expect(phaseForStep("step12_human_final")).toBe("handoff");
  });

  it("rejects skipping steps", () => {
    const ctx = createEmptyGateContext();
    const decision = evaluateStepTransition("step0_plan_freeze", "step2_graph_build", ctx);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons[0]).toContain("非法步骤跳转");
  });

  it("blocks transitions when prerequisites are missing", () => {
    const ctx = createEmptyGateContext();
    const decision = evaluateStepTransition("step0_plan_freeze", "step1_literature_crawl", ctx);
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join(" ")).toContain("研究计划尚未冻结");

    expect(() => advanceStep("step0_plan_freeze", "step1_literature_crawl", ctx)).toThrow(
      "研究计划尚未冻结",
    );
  });

  it("allows advancing when prerequisites are satisfied", () => {
    const ctx = { ...createEmptyGateContext(), hasFrozenPlan: true };
    expect(advanceStep("step0_plan_freeze", "step1_literature_crawl", ctx)).toBe(
      "step1_literature_crawl",
    );
  });
});
