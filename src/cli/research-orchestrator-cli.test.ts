import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerResearchOrchestratorCli } from "./research-orchestrator-cli.js";

const DRAFT = {
  planId: "plan-1",
  projectId: "p1",
  hypothesis: "Works better",
  successCriteria: { primaryMetric: "accuracy", targetValue: 0.85, improvementOverBaseline: 0.05 },
  baselines: [{ name: "baseline", source: "official", metricValues: { accuracy: 0.8 } }],
  datasets: [{ name: "mnist", version: "1.0", split: "train" }],
  evaluationMetrics: ["accuracy"],
  budgetEnvelope: { maxGpuHours: 0, maxCostUsd: 0, maxExperiments: 1 },
  stopRules: { maxFailedAttempts: 1, budgetDepletionPercent: 80, timeLimitHours: 12 },
} as const;

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function createProgram(runtime: {
  error: (message: string) => void;
  exit: (code: number) => void;
}): Command {
  const program = new Command();
  program.name("openclaw");
  const research = program.command("research");
  registerResearchOrchestratorCli(research, runtime);
  return program;
}

async function runCli(program: Command, args: string[]): Promise<void> {
  await program.parseAsync(args, { from: "user" });
}

function lastJson<T>(logs: string[]): T {
  return JSON.parse(logs.at(-1) ?? "{}") as T;
}

async function writeDraft(filePath: string): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(DRAFT, null, 2), "utf8");
}

describe("research orchestrator CLI", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let logs: string[];

  async function startProjectViaCli(program: Command, homeDir: string): Promise<void> {
    await runCli(program, [
      "research",
      "start",
      "--project-id",
      "p1",
      "--topic",
      "graph rag",
      "--home",
      homeDir,
      "--json",
    ]);
  }

  async function freezePlanViaCli(
    program: Command,
    homeDir: string,
    draftPath: string,
  ): Promise<void> {
    await runCli(program, [
      "research",
      "plan",
      "freeze",
      "--project-id",
      "p1",
      "--draft",
      draftPath,
      "--approved-by",
      "human",
      "--home",
      homeDir,
      "--json",
    ]);
  }

  async function requestBudgetViaCli(program: Command, homeDir: string): Promise<string> {
    logs = [];
    await runCli(program, [
      "research",
      "budget",
      "request",
      "--project-id",
      "p1",
      "--purpose",
      "GPU",
      "--cost-usd",
      "10",
      "--duration",
      "2h",
      "--total-usd",
      "100",
      "--home",
      homeDir,
      "--json",
    ]);
    const payload = lastJson<{ request: { requestId: string } }>(logs);
    return payload.request.requestId;
  }

  async function approveBudgetViaCli(
    program: Command,
    homeDir: string,
    requestId: string,
  ): Promise<unknown> {
    logs = [];
    await runCli(program, [
      "research",
      "approve",
      "--project-id",
      "p1",
      "--request-id",
      requestId,
      "--decided-by",
      "finance",
      "--home",
      homeDir,
      "--json",
    ]);
    return lastJson(logs);
  }

  async function statusViaCli(program: Command, homeDir: string): Promise<unknown> {
    logs = [];
    await runCli(program, [
      "research",
      "status",
      "--project-id",
      "p1",
      "--home",
      homeDir,
      "--json",
    ]);
    return lastJson(logs);
  }

  beforeEach(() => {
    logs = [];
    logSpy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      const first = args[0];
      logs.push(typeof first === "string" ? first : "");
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("runs a budget approval closed loop via CLI", async () => {
    const homeDir = await createTempDir("deepscholar-cli-home-");
    const runtime = {
      error: vi.fn(),
      exit: (code: number) => {
        throw new Error(`exit ${code}`);
      },
    };
    const program = createProgram(runtime);

    await startProjectViaCli(program, homeDir);
    const draftPath = path.join(homeDir, "draft.json");
    await writeDraft(draftPath);

    await freezePlanViaCli(program, homeDir, draftPath);
    const requestId = await requestBudgetViaCli(program, homeDir);
    expect(requestId).toMatch(/^budget-/);

    const approved = await approveBudgetViaCli(program, homeDir, requestId);
    expect(approved).toMatchObject({
      request: { status: "approved" },
      project: { lifecycle: "active" },
    });

    const snapshot = (await statusViaCli(program, homeDir)) as {
      project: { gates: { budgetApproved: boolean } };
    };
    expect(snapshot.project.gates.budgetApproved).toBe(true);
  });
});
