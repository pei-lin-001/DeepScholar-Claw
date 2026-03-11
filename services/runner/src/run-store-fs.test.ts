import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createFsRunStore } from "./run-store-fs.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-run-store-"));
}

describe("run store fs", () => {
  it("creates and loads a run record", async () => {
    const homeDir = await createTempDir();
    const store = createFsRunStore({ homeDir });

    const created = await store.create({
      runId: "run-1",
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
    });

    expect(created.paths.runDir).toContain("runs");
    await expect(fs.stat(created.paths.stdoutPath)).resolves.toBeTruthy();
    await expect(fs.stat(created.paths.stderrPath)).resolves.toBeTruthy();
    await expect(fs.stat(created.paths.metricsPath)).resolves.toBeTruthy();
    const loaded = await store.load("p1", "run-1");
    expect(loaded).toMatchObject({ runId: "run-1", projectId: "p1", status: "queued" });
  });

  it("lists runs for a project", async () => {
    const homeDir = await createTempDir();
    const store = createFsRunStore({ homeDir });
    await store.create({ runId: "r1", projectId: "p1", planId: "plan-1", experimentId: "exp-1" });
    await store.create({ runId: "r2", projectId: "p1", planId: "plan-1", experimentId: "exp-1" });

    const runs = await store.list("p1");
    expect(runs.map((run) => run.runId).toSorted()).toEqual(["r1", "r2"]);
  });
});
