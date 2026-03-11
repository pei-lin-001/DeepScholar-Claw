import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import {
  createResearchPlanDraft,
  createResearchProject,
  freezeResearchPlan,
} from "../../packages/deepscholar-contracts/src/index.ts";
import {
  createFsAuditLogStore,
  createFsBudgetApprovalStore,
  createFsProjectStore,
  phaseForStep,
} from "../../services/orchestrator/src/index.js";
import { createFsRunStore } from "../../services/runner/src/index.js";
import type { DockerClient } from "../../services/runner/src/index.js";
import { registerResearchExperimentCli } from "./research-experiment-cli.js";

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function lastJson<T>(logs: string[]): T {
  return JSON.parse(logs.at(-1) ?? "{}") as T;
}

describe("research experiment CLI", () => {
  it("runs an approved experiment and writes back latestRun fields", async () => {
    const homeDir = await createTempDir("deepscholar-exp-cli-");
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

    const orchestrator = {
      projects: createFsProjectStore({ homeDir }),
      approvals: createFsBudgetApprovalStore({ homeDir }),
      audit: createFsAuditLogStore({ homeDir }),
    };

    const draft = createResearchPlanDraft({
      planId: "plan-1",
      projectId: "p1",
      hypothesis: "Works better",
      successCriteria: {
        primaryMetric: "accuracy",
        targetValue: 0.85,
        improvementOverBaseline: 0.05,
      },
      baselines: [
        {
          name: "baseline",
          source: "official",
          metricValues: { accuracy: 0.8 },
        },
      ],
      datasets: [{ name: "mnist", version: "1.0", split: "train" }],
      evaluationMetrics: ["accuracy"],
      budgetEnvelope: { maxGpuHours: 0, maxCostUsd: 0, maxExperiments: 1 },
      stopRules: { maxFailedAttempts: 1, budgetDepletionPercent: 80, timeLimitHours: 12 },
    });
    const plan = freezeResearchPlan({
      draft,
      frozenAt: "2026-03-10T00:00:00.000Z",
      approval: { approvedBy: "human", approvedAt: "2026-03-10T00:00:00.000Z" },
    });

    const base = createResearchProject({
      projectId: "p1",
      title: "Demo",
      topic: "graph rag",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
      lifecycle: "active",
      phase: phaseForStep("step8_cloud_experiment"),
      step: "step8_cloud_experiment",
    });
    await orchestrator.projects.init({
      ...base,
      plan,
      gates: { ...base.gates, hasFrozenPlan: true, budgetApproved: true },
    });

    const program = new Command();
    program.name("openclaw");
    const research = program.command("research");

    registerResearchExperimentCli(research, runtime, () => {
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
        stop: async () => {},
      };
      return { orchestrator, store, docker };
    });

    await program.parseAsync(
      ["research", "experiment", "run", "--project-id", "p1", "--home", homeDir, "--json"],
      { from: "user" },
    );

    const out = lastJson<{
      run: { runId: string; status: string };
      project: { step: string; latestRunId?: string };
    }>(logs);
    expect(out.run.runId).toMatch(/^run-/);
    expect(out.run.status).toBe("succeeded");
    expect(out.project.latestRunId).toBe(out.run.runId);
    expect(out.project.step).toBe("step9_result_validation");
  });
});
