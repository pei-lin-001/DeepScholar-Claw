import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createAuditEntry,
  createResearchProject,
  nowIsoTimestamp,
  type ResearchProject,
} from "@deepscholar/contracts";
import { describe, expect, it } from "vitest";
import { createFsAuditLogStore } from "./audit-log-fs.ts";
import { createFsProjectStore } from "./project-store-fs.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-orch-persist-"));
}

describe("orchestrator persistence", () => {
  it("writes checkpoints and can restore the latest snapshot", async () => {
    const homeDir = await createTempDir();
    const store = createFsProjectStore({ homeDir });

    const createdAt = "2026-03-10T00:00:00.000Z";
    const project = createResearchProject({
      projectId: "p1",
      title: "Demo",
      topic: "graph rag",
      createdAt,
      updatedAt: createdAt,
      phase: "plan",
      step: "step0_plan_freeze",
    });

    await store.init(project);
    await store.checkpoint(project, "init");

    const advanced: ResearchProject = {
      ...project,
      step: "step1_literature_crawl",
      updatedAt: nowIsoTimestamp(),
    };
    await store.save(advanced);
    await store.checkpoint(advanced, "advance");

    const corrupted: ResearchProject = {
      ...advanced,
      step: "step12_human_final",
      updatedAt: nowIsoTimestamp(),
    };
    await store.save(corrupted);

    const restored = await store.restoreLatestCheckpoint("p1");
    expect(restored?.project.step).toBe("step1_literature_crawl");

    const loaded = await store.load("p1");
    expect(loaded.step).toBe("step1_literature_crawl");
  });

  it("appends audit log entries as jsonl", async () => {
    const homeDir = await createTempDir();
    const audit = createFsAuditLogStore({ homeDir });

    const e1 = createAuditEntry({
      timestamp: "2026-03-10T00:00:00.000Z",
      actor: { actorId: "system", actorType: "system" },
      action: "project.init",
      phase: "plan",
      step: "step0_plan_freeze",
      details: { input: "none", output: "created" },
    });
    const e2 = createAuditEntry({
      timestamp: "2026-03-10T00:00:01.000Z",
      actor: { actorId: "human", actorType: "human" },
      action: "plan.freeze",
      phase: "plan",
      step: "step0_plan_freeze",
      details: { input: "draft", output: "frozen" },
    });

    await audit.append("p1", e1);
    await audit.append("p1", e2);
    const entries = await audit.list("p1");
    expect(entries.map((entry) => entry.action)).toEqual(["project.init", "plan.freeze"]);
  });
});
