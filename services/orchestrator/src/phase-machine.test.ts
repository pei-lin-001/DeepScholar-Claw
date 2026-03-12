import { describe, expect, it } from "vitest";
import { advancePhase, canAdvancePhase, createInitialPhaseState } from "./index.ts";

describe("phase machine", () => {
  it("advances in declared order", () => {
    const state = createInitialPhaseState();
    expect(canAdvancePhase(state, "literature")).toBe(true);
    const next = advancePhase(state, "literature");
    expect(next.current).toBe("literature");
    expect(next.completed).toEqual(["charter"]);
  });

  it("rejects skipping phases", () => {
    const state = createInitialPhaseState();
    expect(canAdvancePhase(state, "proposal")).toBe(false);
    expect(() => advancePhase(state, "proposal")).toThrow("非法阶段跳转");
  });
});
