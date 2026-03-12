import type { RateLimiter, RateLimitPolicy } from "./types.ts";

export type RateLimiterDeps = {
  readonly nowMs?: () => number;
  readonly sleepMs?: (ms: number) => Promise<void>;
};

const DEFAULT_SLEEP_STEP_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createRateLimiter(
  policy: RateLimitPolicy,
  deps: RateLimiterDeps = {},
): RateLimiter {
  if (policy.requests < 1) {
    throw new Error("RateLimitPolicy.requests 必须 >= 1");
  }
  if (policy.windowMs < 1) {
    throw new Error("RateLimitPolicy.windowMs 必须 >= 1");
  }

  const nowMs = deps.nowMs ?? (() => Date.now());
  const sleepMs = deps.sleepMs ?? sleep;
  const timestamps: number[] = [];

  async function acquireSlot(): Promise<void> {
    const now = nowMs();
    while (timestamps.length > 0 && timestamps[0] <= now - policy.windowMs) {
      timestamps.shift();
    }
    if (timestamps.length < policy.requests) {
      timestamps.push(now);
      return;
    }

    const oldest = timestamps[0] ?? now;
    const waitMs = Math.max(oldest + policy.windowMs - now, DEFAULT_SLEEP_STEP_MS);
    await sleepMs(waitMs);
    await acquireSlot();
  }

  return { acquireSlot };
}
