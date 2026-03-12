export type FailureType = "infrastructure" | "implementation" | "scientific";

export type FailureSignal = {
  readonly timedOut: boolean;
  readonly exitCode: number | null;
  readonly hasEnvironmentError: boolean;
  readonly hasRuntimeError: boolean;
  readonly metricsHealthy: boolean;
  readonly reproduced: boolean;
};

export type FailurePolicy = {
  readonly maxRetries: number;
  readonly nextAction: "retry" | "debug_fix" | "pivot";
};

export function classifyFailure(signal: FailureSignal): FailureType {
  if (signal.timedOut || signal.hasEnvironmentError || signal.exitCode === 137) {
    return "infrastructure";
  }
  if (signal.hasRuntimeError) {
    return "implementation";
  }
  if (signal.metricsHealthy && signal.reproduced) {
    return "scientific";
  }
  return "implementation";
}

export function failurePolicy(type: FailureType): FailurePolicy {
  if (type === "infrastructure") {
    return { maxRetries: 2, nextAction: "retry" };
  }
  if (type === "implementation") {
    return { maxRetries: 3, nextAction: "debug_fix" };
  }
  return { maxRetries: 1, nextAction: "pivot" };
}
