import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DockerClient } from "./docker-client.ts";
import { retryRun } from "./run-retry.ts";
import { createFsRunStore } from "./run-store-fs.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-retry-"));
}

const fakeDocker: DockerClient = {
  runSmoke: async (input) => {
    await fs.writeFile(
      path.join(input.runDir, "metrics.json"),
      JSON.stringify({ health: 1 }, null, 2),
      "utf8",
    );
    await fs.appendFile(input.stdoutPath, "ok\n", "utf8");
    return { exitCode: 0, signal: null, timedOut: false };
  },
  runProgram: async (input) => {
    await fs.writeFile(
      path.join(input.runDir, "metrics.json"),
      JSON.stringify({ health: 1 }, null, 2),
      "utf8",
    );
    await fs.appendFile(input.stdoutPath, `cmd=${input.command.join(" ")}\n`, "utf8");
    return { exitCode: 0, signal: null, timedOut: false };
  },
  stop: async () => {},
};

describe("run retry", () => {
  it("retries a failed smoke run as a new run with retryOfRunId set", async () => {
    const homeDir = await createTempDir();
    const store = createFsRunStore({ homeDir });
    await store.create({
      runId: "r-orig",
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      status: "failed",
    });
    await store.save({
      ...(await store.load("p1", "r-orig")),
      status: "failed",
      exitCode: 1,
      executionRequest: {
        driver: "docker",
        kind: "smoke",
        image: "alpine:3.20",
        sandboxProfile: "compat",
        holdSeconds: 1,
        timeoutMs: 10_000,
      },
    });

    const retried = await retryRun(store, fakeDocker, { projectId: "p1", runId: "r-orig" });
    expect(retried.runId).not.toBe("r-orig");
    expect(retried.status).toBe("succeeded");
    expect(retried.retryOfRunId).toBe("r-orig");
  });

  it("retries a failed template run", async () => {
    const homeDir = await createTempDir();
    const store = createFsRunStore({ homeDir });
    await store.create({
      runId: "r-tpl",
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      status: "failed",
    });
    await store.save({
      ...(await store.load("p1", "r-tpl")),
      status: "failed",
      exitCode: 1,
      executionRequest: {
        driver: "docker",
        kind: "template",
        image: "python:3.11-slim",
        sandboxProfile: "compat",
        templateId: "python_smoke",
        timeoutMs: 10_000,
      },
    });

    const retried = await retryRun(store, fakeDocker, { projectId: "p1", runId: "r-tpl" });
    expect(retried.runId).not.toBe("r-tpl");
    expect(retried.status).toBe("succeeded");
    expect(retried.retryOfRunId).toBe("r-tpl");
  });

  it("throws on unsupported kind=program", async () => {
    const homeDir = await createTempDir();
    const store = createFsRunStore({ homeDir });
    await store.create({
      runId: "r-prog",
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      status: "failed",
    });
    await store.save({
      ...(await store.load("p1", "r-prog")),
      status: "failed",
      exitCode: 1,
      executionRequest: {
        driver: "docker",
        kind: "program" as "smoke",
        image: "alpine:3.20",
        sandboxProfile: "compat",
        command: ["python", "main.py"],
        timeoutMs: 10_000,
      },
    });

    await expect(retryRun(store, fakeDocker, { projectId: "p1", runId: "r-prog" })).rejects.toThrow(
      "暂不支持 retry",
    );
  });

  it("throws when trying to retry a succeeded run", async () => {
    const homeDir = await createTempDir();
    const store = createFsRunStore({ homeDir });
    await store.create({
      runId: "r-ok",
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      status: "succeeded",
    });
    await store.save({
      ...(await store.load("p1", "r-ok")),
      status: "succeeded",
      exitCode: 0,
    });

    await expect(retryRun(store, fakeDocker, { projectId: "p1", runId: "r-ok" })).rejects.toThrow(
      "已成功",
    );
  });

  it("throws when run has no executionRequest", async () => {
    const homeDir = await createTempDir();
    const store = createFsRunStore({ homeDir });
    await store.create({
      runId: "r-noreq",
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      status: "failed",
    });
    await store.save({
      ...(await store.load("p1", "r-noreq")),
      status: "failed",
      exitCode: 1,
    });

    await expect(
      retryRun(store, fakeDocker, { projectId: "p1", runId: "r-noreq" }),
    ).rejects.toThrow("executionRequest");
  });
});
