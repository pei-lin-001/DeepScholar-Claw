import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { DockerClient } from "./docker-client.ts";
import { createFsRunStore } from "./run-store-fs.ts";
import { runTemplateExperiment } from "./template-runner.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-template-runner-"));
}

describe("template runner", () => {
  it("renders a python template and executes it via docker client", async () => {
    const homeDir = await createTempDir();
    const store = createFsRunStore({ homeDir });

    const docker: DockerClient = {
      runSmoke: async () => ({ exitCode: 0, signal: null, timedOut: false }),
      runProgram: async (input) => {
        const mainPath = path.join(input.runDir, "main.py");
        const source = await fs.readFile(mainPath, "utf8");
        expect(source).toContain("template: start");
        expect(input.command.join(" ")).toContain("python");
        await fs.writeFile(
          path.join(input.runDir, "metrics.json"),
          JSON.stringify({ health: 1 }, null, 2),
          "utf8",
        );
        await fs.appendFile(input.stdoutPath, "template ok\n", "utf8");
        return { exitCode: 0, signal: null, timedOut: false };
      },
      stop: async () => {},
    };

    const run = await runTemplateExperiment(store, docker, {
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      templateId: "python_smoke",
      image: "python:3.11-slim",
      sandboxProfile: "compat",
      timeoutMs: 10_000,
    });

    expect(run.status).toBe("succeeded");
    const metricsRaw = await fs.readFile(store.pathsFor("p1", run.runId).metricsPath, "utf8");
    expect(JSON.parse(metricsRaw)).toMatchObject({ health: 1 });
  });
});
