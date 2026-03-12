import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { diagnoseRun } from "./run-diagnoser.ts";
import { createFsRunStore } from "./run-store-fs.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-diagnoser-"));
}

async function seedRun(
  homeDir: string,
  overrides: {
    readonly status?: string;
    readonly exitCode?: number;
    readonly stderr?: string;
    readonly metrics?: unknown;
  },
) {
  const store = createFsRunStore({ homeDir });
  await store.create({
    runId: "r1",
    projectId: "p1",
    planId: "plan-1",
    experimentId: "exp-1",
    status: (overrides.status ?? "failed") as Parameters<typeof store.create>[0]["status"],
  });
  const run = await store.load("p1", "r1");
  await store.save({
    ...run,
    status: (overrides.status ?? "failed") as typeof run.status,
    exitCode: overrides.exitCode,
    failure:
      overrides.status === "failed" ? { type: "implementation", message: "test" } : undefined,
  });
  const paths = store.pathsFor("p1", "r1");
  if (overrides.stderr !== undefined) {
    await fs.writeFile(paths.stderrPath, overrides.stderr, "utf8");
  }
  if (overrides.metrics !== undefined) {
    await fs.writeFile(paths.metricsPath, JSON.stringify(overrides.metrics, null, 2), "utf8");
  }
  return store;
}

describe("run diagnoser", () => {
  it("diagnoses a succeeded run as nextAction=none", async () => {
    const homeDir = await createTempDir();
    const store = await seedRun(homeDir, { status: "succeeded", exitCode: 0 });
    const d = await diagnoseRun({ store, projectId: "p1", runId: "r1" });
    expect(d.policy.nextAction).toBe("none");
    expect(d.rootCause).toContain("成功");
  });

  it("diagnoses a queued run as nextAction=none", async () => {
    const homeDir = await createTempDir();
    const store = await seedRun(homeDir, { status: "queued" });
    const d = await diagnoseRun({ store, projectId: "p1", runId: "r1" });
    expect(d.policy.nextAction).toBe("none");
    expect(d.rootCause).toContain("排队");
  });

  it("diagnoses a running run as nextAction=none", async () => {
    const homeDir = await createTempDir();
    const store = await seedRun(homeDir, { status: "running" });
    const d = await diagnoseRun({ store, projectId: "p1", runId: "r1" });
    expect(d.policy.nextAction).toBe("none");
    expect(d.suggestedFix).toContain("collect");
  });

  it("diagnoses timeout as infrastructure/retry", async () => {
    const homeDir = await createTempDir();
    const store = await seedRun(homeDir, {
      status: "timeout",
      stderr: "[runner] stage=container.run image=python:3.11\n",
    });
    const d = await diagnoseRun({ store, projectId: "p1", runId: "r1" });
    expect(d.policy.nextAction).toBe("retry");
    expect(d.failureType).toBe("infrastructure");
    expect(d.rootCause).toContain("超时");
  });

  it("diagnoses OOM (exitCode=137) as infrastructure/retry", async () => {
    const homeDir = await createTempDir();
    const store = await seedRun(homeDir, {
      status: "failed",
      exitCode: 137,
      stderr: "[runner] stage=container.run image=python:3.11\nKilled\n",
    });
    const d = await diagnoseRun({ store, projectId: "p1", runId: "r1" });
    expect(d.policy.nextAction).toBe("retry");
    expect(d.failureType).toBe("infrastructure");
    expect(d.rootCause).toContain("137");
  });

  it("diagnoses Docker daemon error as infrastructure/retry", async () => {
    const homeDir = await createTempDir();
    const store = await seedRun(homeDir, {
      status: "failed",
      exitCode: 125,
      stderr: "Cannot connect to the Docker daemon at unix:///var/run/docker.sock\n",
    });
    const d = await diagnoseRun({ store, projectId: "p1", runId: "r1" });
    expect(d.failureType).toBe("infrastructure");
    expect(d.policy.nextAction).toBe("retry");
  });

  it("diagnoses image pull failure as infrastructure with image-stage hint", async () => {
    const homeDir = await createTempDir();
    const store = await seedRun(homeDir, {
      status: "failed",
      exitCode: 1,
      stderr: "[runner] stage=image.pull image=nonexistent:latest\npull access denied\n",
    });
    const d = await diagnoseRun({ store, projectId: "p1", runId: "r1" });
    expect(d.failureType).toBe("infrastructure");
    expect(d.stage).toBe("image.pull");
    expect(d.suggestedFix).toContain("镜像");
  });

  it("diagnoses Python traceback as implementation/debug_fix", async () => {
    const homeDir = await createTempDir();
    const store = await seedRun(homeDir, {
      status: "failed",
      exitCode: 1,
      stderr: [
        "[runner] stage=container.run image=python:3.11",
        "Traceback (most recent call last):",
        '  File "main.py", line 5',
        "NameError: name 'foo' is not defined",
      ].join("\n"),
    });
    const d = await diagnoseRun({ store, projectId: "p1", runId: "r1" });
    expect(d.failureType).toBe("implementation");
    expect(d.policy.nextAction).toBe("debug_fix");
    expect(d.rootCause).toContain("抛错");
  });

  it("diagnoses aborted run", async () => {
    const homeDir = await createTempDir();
    const store = await seedRun(homeDir, { status: "aborted" });
    const d = await diagnoseRun({ store, projectId: "p1", runId: "r1" });
    expect(d.rootCause).toContain("终止");
  });
});
