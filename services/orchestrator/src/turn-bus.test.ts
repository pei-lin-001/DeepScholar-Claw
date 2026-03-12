import { describe, expect, it } from "vitest";
import { createTurnBus } from "./turn-bus.ts";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("turn bus", () => {
  it("processes submitted turns sequentially", async () => {
    const bus = createTurnBus();
    const trace: string[] = [];

    const a = bus.submit(
      { messageId: "m1", type: "a", createdAt: "2026-03-10T00:00:00.000Z", payload: {} },
      async () => {
        trace.push("a:start");
        await sleep(20);
        trace.push("a:end");
        return "a";
      },
    );
    const b = bus.submit(
      { messageId: "m2", type: "b", createdAt: "2026-03-10T00:00:01.000Z", payload: {} },
      async () => {
        trace.push("b:start");
        trace.push("b:end");
        return "b";
      },
    );

    await expect(Promise.all([a, b])).resolves.toEqual(["a", "b"]);
    expect(trace).toEqual(["a:start", "a:end", "b:start", "b:end"]);
    expect(bus.pendingCount()).toBe(0);
  });

  it("continues after a failed turn and does not swallow errors", async () => {
    const bus = createTurnBus();
    const trace: string[] = [];

    const failing = bus.submit(
      { messageId: "m1", type: "fail", createdAt: "2026-03-10T00:00:00.000Z", payload: {} },
      async () => {
        trace.push("fail:start");
        throw new Error("boom");
      },
    );
    await expect(failing).rejects.toThrow("boom");

    const ok = await bus.submit(
      { messageId: "m2", type: "ok", createdAt: "2026-03-10T00:00:01.000Z", payload: {} },
      async () => {
        trace.push("ok");
        return 1;
      },
    );

    expect(ok).toBe(1);
    expect(trace).toEqual(["fail:start", "ok"]);
  });
});
