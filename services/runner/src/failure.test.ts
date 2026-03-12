import { describe, expect, it } from "vitest";
import { classifyFailure, failurePolicy } from "./index.ts";

describe("failure classification", () => {
  it("classifies timeout and oom as infrastructure", () => {
    expect(
      classifyFailure({
        timedOut: true,
        exitCode: 137,
        hasEnvironmentError: false,
        hasRuntimeError: false,
        metricsHealthy: false,
        reproduced: false,
      }),
    ).toBe("infrastructure");
  });

  it("classifies healthy reproduced non-improvement as scientific", () => {
    const type = classifyFailure({
      timedOut: false,
      exitCode: 0,
      hasEnvironmentError: false,
      hasRuntimeError: false,
      metricsHealthy: true,
      reproduced: true,
    });
    expect(type).toBe("scientific");
    expect(failurePolicy(type)).toEqual({ maxRetries: 1, nextAction: "pivot" });
  });
});
