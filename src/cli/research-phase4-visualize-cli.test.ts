import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import {
  createFsAuditLogStore,
  createFsBudgetApprovalStore,
  createFsProjectStore,
  phaseForStep,
} from "../../services/orchestrator/src/index.js";
import { createFsRunStore } from "../../services/runner/src/index.js";
import { registerResearchOrchestratorCli } from "./research-orchestrator-cli.js";
import { createResearchProject } from "../../packages/deepscholar-contracts/src/index.ts";

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function lastJson<T>(logs: string[]): T {
  return JSON.parse(logs.at(-1) ?? "{}") as T;
}

function createRuntime(logs: string[]) {
  return {
    log: (...args: unknown[]) => {
      const first = args[0];
      logs.push(typeof first === "string" ? first : "");
    },
    error: vi.fn(),
    exit: (code: number) => {
      throw new Error(`exit ${code}`);
    },
  };
}

async function seedRunMetrics(
  homeDir: string,
  runId: string,
  metrics: Readonly<Record<string, number>>,
): Promise<void> {
  const store = createFsRunStore({ homeDir });
  const created = await store.create({
    runId,
    projectId: "p1",
    planId: "plan-1",
    experimentId: `exp-${runId}`,
    status: "succeeded",
  });
  await fs.writeFile(created.paths.metricsPath, JSON.stringify(metrics, null, 2), "utf8");
}

describe("research phase4 visualize CLI", () => {
  it("generates visual evidence from metrics and writes refs back into draft", async () => {
    const homeDir = await createTempDir("deepscholar-phase4-visualize-cli-");
    const logs: string[] = [];
    const runtime = createRuntime(logs);

    const program = new Command();
    program.name("deepscholar");
    const research = program.command("research");
    registerResearchOrchestratorCli(research, runtime, (home) => ({
      orchestrator: {
        projects: createFsProjectStore({ homeDir: home }),
        approvals: createFsBudgetApprovalStore({ homeDir: home }),
        audit: createFsAuditLogStore({ homeDir: home }),
      },
      createLatexCompiler: () => ({
        compile: async () => {
          throw new Error("compile should not be called");
        },
      }),
    }));

    const store = createFsProjectStore({ homeDir });
    const project = createResearchProject({
      projectId: "p1",
      title: "Demo",
      topic: "graph rag",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
      lifecycle: "active",
      phase: phaseForStep("step10_paper_writing"),
      step: "step10_paper_writing",
    });
    await store.init({
      ...project,
      gates: { ...project.gates, experimentCompleted: true, resultsVerified: true },
    });
    await seedRunMetrics(homeDir, "run-a", { accuracy: 0.91, loss: 0.12 });
    await seedRunMetrics(homeDir, "run-b", { accuracy: 0.95, loss: 0.08 });

    logs.length = 0;
    await program.parseAsync(
      [
        "research",
        "paper",
        "write",
        "--project-id",
        "p1",
        "--draft-id",
        "d1",
        "--plan-id",
        "plan-1",
        "--title",
        "Demo Paper",
        "--home",
        homeDir,
        "--json",
      ],
      { from: "user" },
    );

    logs.length = 0;
    await program.parseAsync(
      [
        "research",
        "paper",
        "visualize",
        "--project-id",
        "p1",
        "--draft-id",
        "d1",
        "--visual-id",
        "baseline-vs-model",
        "--run-ids",
        "run-a,run-b",
        "--metrics",
        "accuracy,loss",
        "--caption",
        "Validated metrics snapshot",
        "--home",
        homeDir,
        "--json",
      ],
      { from: "user" },
    );
    const visualized = lastJson<{
      draft: { sections: { results: string } };
      visual: { tableRef: string; figureRef: string; chartTexPath: string };
    }>(logs);
    expect(visualized.visual.tableRef).toBe("tab:baseline-vs-model");
    expect(visualized.visual.figureRef).toBe("fig:baseline-vs-model");
    expect(visualized.visual.chartTexPath).toContain(path.join("paper", "figures"));
    expect(visualized.draft.sections.results).toContain("\\input{../../figures/baseline-vs-model/table.tex}");
    expect(visualized.draft.sections.results).toContain("\\input{../../figures/baseline-vs-model/chart.tex}");
  });
});
