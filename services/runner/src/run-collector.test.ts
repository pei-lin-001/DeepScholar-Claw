import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { collectRunSummary } from "./run-collector.ts";
import { createFsRunStore } from "./run-store-fs.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-run-collect-"));
}

describe("run collector", () => {
  it("loads metrics and tails logs", async () => {
    const homeDir = await createTempDir();
    const store = createFsRunStore({ homeDir });

    await store.create({
      runId: "r1",
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      status: "succeeded",
    });

    const paths = store.pathsFor("p1", "r1");
    await fs.writeFile(paths.metricsPath, JSON.stringify({ health: 1 }, null, 2), "utf8");
    await fs.writeFile(paths.stdoutPath, "hello\nworld\n", "utf8");
    await fs.writeFile(paths.stderrPath, "warn\n", "utf8");

    const summary = await collectRunSummary({ store, projectId: "p1", runId: "r1", tailBytes: 20 });
    expect(summary.run.runId).toBe("r1");
    expect(summary.metrics).toMatchObject({ health: 1 });
    expect(summary.stdoutTail).toContain("world");
    expect(summary.stderrTail).toContain("warn");
  });
});
