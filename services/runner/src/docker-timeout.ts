export type TimeoutBudget = {
  readonly startedAtMs: number;
  readonly totalTimeoutMs: number;
};

export function createTimeoutBudget(totalTimeoutMs: number): TimeoutBudget {
  return { startedAtMs: Date.now(), totalTimeoutMs };
}

export function remainingTimeoutMs(budget: TimeoutBudget): number {
  const elapsedMs = Date.now() - budget.startedAtMs;
  return Math.max(0, budget.totalTimeoutMs - elapsedMs);
}
