import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import { createFsRunStore } from "../../services/runner/src/index.js";
import type { DockerClient } from "../../services/runner/src/index.js";
import { registerResearchRunnerCli } from "./research-runner-cli.js";

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function createProgram(runtime: {
  log: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  exit: (code: number) => void;
}): Command {
  const program = new Command();
  program.name("deepscholar");
  const research = program.command("research");
  registerResearchRunnerCli(research, runtime, (homeDir?: string) => {
    const store = createFsRunStore({ homeDir });
    const docker: DockerClient = {
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
      stop: async (containerName: string) => {
        runtime.log(`stopped:${containerName}`);
      },
    };
    return { store, docker };
  });
  return program;
}

function lastJson<T>(logs: string[]): T {
  return JSON.parse(logs.at(-1) ?? "{}") as T;
}

describe("research runner CLI", () => {
  it("runs smoke and loads status", async () => {
    const homeDir = await createTempDir("deepscholar-runner-cli-");
    const logs: string[] = [];
    const runtime = {
      log: (...args: unknown[]) => {
        const first = args[0];
        logs.push(typeof first === "string" ? first : "");
      },
      error: vi.fn(),
      exit: (code: number) => {
        throw new Error(`exit ${code}`);
      },
    };
    const program = createProgram(runtime);

    await program.parseAsync(
      ["research", "runner", "smoke", "--project-id", "p1", "--home", homeDir, "--json"],
      {
        from: "user",
      },
    );
    const run = lastJson<{ runId: string; status: string }>(logs);
    expect(run.runId).toMatch(/^run-/);
    expect(run.status).toBe("succeeded");

    logs.length = 0;
    await program.parseAsync(
      [
        "research",
        "runner",
        "status",
        "--project-id",
        "p1",
        "--run-id",
        run.runId,
        "--home",
        homeDir,
        "--json",
      ],
      { from: "user" },
    );
    const loaded = lastJson<{ runId: string; status: string }>(logs);
    expect(loaded.runId).toBe(run.runId);
    expect(loaded.status).toBe("succeeded");
  });

  it("collects a run snapshot", async () => {
    const homeDir = await createTempDir("deepscholar-runner-cli-");
    const logs: string[] = [];
    const runtime = {
      log: (...args: unknown[]) => {
        const first = args[0];
        logs.push(typeof first === "string" ? first : "");
      },
      error: vi.fn(),
      exit: (code: number) => {
        throw new Error(`exit ${code}`);
      },
    };
    const program = createProgram(runtime);

    await program.parseAsync(
      ["research", "runner", "smoke", "--project-id", "p1", "--home", homeDir, "--json"],
      {
        from: "user",
      },
    );
    const run = lastJson<{ runId: string; status: string }>(logs);
    expect(run.status).toBe("succeeded");

    logs.length = 0;
    await program.parseAsync(
      [
        "research",
        "runner",
        "collect",
        "--project-id",
        "p1",
        "--run-id",
        run.runId,
        "--home",
        homeDir,
        "--json",
      ],
      { from: "user" },
    );
    const collected = lastJson<{ run: { runId: string }; metrics: { health: number } }>(logs);
    expect(collected.run.runId).toBe(run.runId);
    expect(collected.metrics.health).toBe(1);
  });

  it("lists runs for a project", async () => {
    const homeDir = await createTempDir("deepscholar-runner-cli-");
    const logs: string[] = [];
    const runtime = {
      log: (...args: unknown[]) => {
        const first = args[0];
        logs.push(typeof first === "string" ? first : "");
      },
      error: vi.fn(),
      exit: (code: number) => {
        throw new Error(`exit ${code}`);
      },
    };

    const store = createFsRunStore({ homeDir });
    await store.create({ runId: "r1", projectId: "p1", planId: "plan-1", experimentId: "exp-1" });
    await store.create({ runId: "r2", projectId: "p1", planId: "plan-1", experimentId: "exp-1" });
    await store.save({ ...(await store.load("p1", "r1")), updatedAt: "2026-03-11T00:00:00.000Z" });
    await store.save({ ...(await store.load("p1", "r2")), updatedAt: "2026-03-11T00:00:01.000Z" });
    await store.create({
      runId: "other",
      projectId: "p2",
      planId: "plan-1",
      experimentId: "exp-1",
    });

    const program = createProgram(runtime);
    await program.parseAsync(
      ["research", "runner", "list", "--project-id", "p1", "--home", homeDir, "--json"],
      {
        from: "user",
      },
    );
    const runs = lastJson<{ runId: string; status: string }[]>(logs);
    expect(runs.map((run) => run.runId)).toEqual(["r2", "r1"]);
    expect(runs.map((run) => run.status).every((status) => typeof status === "string")).toBe(true);
  });

  it("aborts a running run", async () => {
    const homeDir = await createTempDir("deepscholar-runner-cli-");
    const logs: string[] = [];
    const runtime = {
      log: (...args: unknown[]) => {
        const first = args[0];
        logs.push(typeof first === "string" ? first : "");
      },
      error: vi.fn(),
      exit: (code: number) => {
        throw new Error(`exit ${code}`);
      },
    };

    const store = createFsRunStore({ homeDir });
    await store.create({
      runId: "run-1",
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      status: "running",
    });
    await store.save({
      ...(await store.load("p1", "run-1")),
      status: "running",
      startedAt: "2026-03-11T00:00:00.000Z",
      execution: { driver: "docker", containerName: "c1" },
    });

    const program = createProgram(runtime);
    await program.parseAsync(
      [
        "research",
        "runner",
        "abort",
        "--project-id",
        "p1",
        "--run-id",
        "run-1",
        "--home",
        homeDir,
        "--json",
      ],
      {
        from: "user",
      },
    );
    const aborted = lastJson<{ runId: string; status: string }>(
      logs.filter((line) => line.trim().startsWith("{")),
    );
    expect(aborted.runId).toBe("run-1");
    expect(aborted.status).toBe("aborted");
  });

  it("diagnoses a failed run and suggests next action", async () => {
    const homeDir = await createTempDir("deepscholar-runner-cli-");
    const logs: string[] = [];
    const runtime = {
      log: (...args: unknown[]) => {
        const first = args[0];
        logs.push(typeof first === "string" ? first : "");
      },
      error: vi.fn(),
      exit: (code: number) => {
        throw new Error(`exit ${code}`);
      },
    };

    const store = createFsRunStore({ homeDir });
    await store.create({
      runId: "run-fail-1",
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      status: "failed",
    });
    await store.save({
      ...(await store.load("p1", "run-fail-1")),
      status: "failed",
      exitCode: 1,
      failure: { type: "implementation", message: "crashed" },
    });
    const paths = store.pathsFor("p1", "run-fail-1");
    await fs.writeFile(
      paths.stderrPath,
      ["[runner] stage=container.run image=alpine:3.20", "Traceback (most recent call last):"].join(
        "\n",
      ),
      "utf8",
    );
    await fs.writeFile(paths.metricsPath, JSON.stringify({ health: 0 }, null, 2), "utf8");

    const program = createProgram(runtime);
    await program.parseAsync(
      [
        "research",
        "runner",
        "diagnose",
        "--project-id",
        "p1",
        "--run-id",
        "run-fail-1",
        "--home",
        homeDir,
        "--json",
      ],
      { from: "user" },
    );

    const diagnosis = lastJson<{
      rootCause: string;
      suggestedFix: string;
      policy: { nextAction: string; maxRetries: number };
    }>(logs);
    expect(diagnosis.rootCause).toContain("抛错");
    expect(diagnosis.suggestedFix).toContain("修复");
    expect(diagnosis.policy).toEqual({ nextAction: "debug_fix", maxRetries: 3 });
  });

  it("retries a failed run as a new runId", async () => {
    const homeDir = await createTempDir("deepscholar-runner-cli-");
    const logs: string[] = [];
    const runtime = {
      log: (...args: unknown[]) => {
        const first = args[0];
        logs.push(typeof first === "string" ? first : "");
      },
      error: vi.fn(),
      exit: (code: number) => {
        throw new Error(`exit ${code}`);
      },
    };

    const store = createFsRunStore({ homeDir });
    await store.create({
      runId: "run-fail-2",
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      status: "failed",
    });
    await store.save({
      ...(await store.load("p1", "run-fail-2")),
      status: "failed",
      exitCode: 1,
      failure: { type: "implementation", message: "crashed" },
      executionRequest: {
        driver: "docker",
        kind: "smoke",
        image: "alpine:3.20",
        sandboxProfile: "compat",
        holdSeconds: 1,
        timeoutMs: 10_000,
      },
    });

    const program = createProgram(runtime);
    await program.parseAsync(
      [
        "research",
        "runner",
        "retry",
        "--project-id",
        "p1",
        "--run-id",
        "run-fail-2",
        "--home",
        homeDir,
        "--json",
      ],
      { from: "user" },
    );

    const retried = lastJson<{ runId: string; status: string; retryOfRunId?: string }>(logs);
    expect(retried.runId).toMatch(/^run-/);
    expect(retried.runId).not.toBe("run-fail-2");
    expect(retried.status).toBe("succeeded");
    expect(retried.retryOfRunId).toBe("run-fail-2");
  });
});
