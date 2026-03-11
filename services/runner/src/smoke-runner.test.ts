import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DockerClient } from "./docker-client.ts";
import { createFsRunStore } from "./run-store-fs.ts";
import { abortRun, runSmokeExperiment } from "./smoke-runner.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-runner-"));
}

describe("smoke runner", () => {
  it("runs a smoke experiment and records succeeded status", async () => {
    const homeDir = await createTempDir();
    const store = createFsRunStore({ homeDir });

    const docker: DockerClient = {
      runSmoke: async (input) => {
        await fs.appendFile(input.stdoutPath, "hello\n", "utf8");
        await fs.writeFile(
          path.join(input.runDir, "metrics.json"),
          JSON.stringify({ health: 1 }, null, 2),
          "utf8",
        );
        return { exitCode: 0, signal: null, timedOut: false };
      },
      stop: async () => {},
    };

    const run = await runSmokeExperiment(store, docker, {
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      image: "alpine:3.20",
      holdSeconds: 1,
      timeoutMs: 10_000,
    });

    expect(run.status).toBe("succeeded");
    expect(run.execution?.driver).toBe("docker");
    const saved = await store.load("p1", run.runId);
    expect(saved.status).toBe("succeeded");
  });

  it("records timeout status when docker reports timedOut", async () => {
    const homeDir = await createTempDir();
    const store = createFsRunStore({ homeDir });

    const docker: DockerClient = {
      runSmoke: async () => ({ exitCode: null, signal: null, timedOut: true }),
      stop: async () => {},
    };

    const run = await runSmokeExperiment(store, docker, {
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      image: "alpine:3.20",
      holdSeconds: 1,
      timeoutMs: 1,
    });

    expect(run.status).toBe("timeout");
  });

  it("aborts a running run via docker stop", async () => {
    const homeDir = await createTempDir();
    const store = createFsRunStore({ homeDir });

    const created = await store.create({
      runId: "run-1",
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      status: "running",
    });
    await store.save({
      ...created.run,
      status: "running",
      startedAt: "2026-03-11T00:00:00.000Z",
      execution: { driver: "docker", containerName: "c1" },
    });

    const stopped: string[] = [];
    const docker: DockerClient = {
      runSmoke: async () => ({ exitCode: 0, signal: null, timedOut: false }),
      stop: async (name) => {
        stopped.push(name);
      },
    };

    const aborted = await abortRun(store, docker, { projectId: "p1", runId: "run-1" });
    expect(stopped).toEqual(["c1"]);
    expect(aborted.status).toBe("aborted");
  });
});
