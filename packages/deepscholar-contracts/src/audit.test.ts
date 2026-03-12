import { describe, expect, it } from "vitest";
import { createAuditEntry, validateAuditEntry } from "./index.ts";

describe("audit contracts", () => {
  it("validates audit entries and rejects empty fields", () => {
    const entry = createAuditEntry({
      timestamp: "2026-03-10T00:00:00.000Z",
      actor: { actorId: "auditor", actorType: "bot" },
      action: "freeze_plan",
      phase: "plan",
      step: "step0_plan_freeze",
      details: { input: "draft", output: "frozen" },
    });
    expect(validateAuditEntry(entry)).toEqual([]);

    const bad = createAuditEntry({
      timestamp: "not-a-time",
      actor: { actorId: "", actorType: "human" },
      action: "",
      phase: "plan",
      step: "step0_plan_freeze",
      details: { input: "", output: "" },
    });
    expect(validateAuditEntry(bad).length).toBeGreaterThan(0);
  });
});
