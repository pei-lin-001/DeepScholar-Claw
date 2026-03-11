import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Command } from "commander";
import { describe, expect, it, vi } from "vitest";
import {
  createPeerReview,
  createReviewRubric,
  createResearchProject,
  type ReviewDimensionAssessment,
} from "../../packages/deepscholar-contracts/src/index.ts";
import {
  createFsAuditLogStore,
  createFsBudgetApprovalStore,
  createFsProjectStore,
  phaseForStep,
} from "../../services/orchestrator/src/index.js";
import type { LatexCompiler } from "../../services/writing/src/index.js";
import { registerResearchOrchestratorCli } from "./research-orchestrator-cli.js";

async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

function lastJson<T>(logs: string[]): T {
  return JSON.parse(logs.at(-1) ?? "{}") as T;
}

function createRubric(score: number) {
  const assessment: ReviewDimensionAssessment = { score, evidence: "sec" };
  return createReviewRubric({
    dimensions: {
      originality: assessment,
      soundness: assessment,
      experimentalRigor: assessment,
      clarity: assessment,
      relatedWorkCompleteness: assessment,
      practicalImpact: assessment,
      ethicsAndReproducibility: assessment,
    },
  });
}

describe("research phase4 CLI", () => {
  it("runs validate -> paper write -> paper compile -> review decide closed loop", async () => {
    const homeDir = await createTempDir("deepscholar-phase4-cli-");
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

    const fakeCompiler: LatexCompiler = {
      compile: async (input) => {
        await fs.mkdir(input.draftDir, { recursive: true });
        await fs.writeFile(input.compileLogPath, "ok\n", "utf8");
        await fs.writeFile(input.compiledPdfPath, "%PDF-1.4\n", "utf8");
        return {
          status: "success",
          exitCode: 0,
          durationMs: 5,
          compiler: "unknown",
          outputPdfPath: input.compiledPdfPath,
          compileLogPath: input.compileLogPath,
        };
      },
    };

    const program = new Command();
    program.name("openclaw");
    const research = program.command("research");

    registerResearchOrchestratorCli(research, runtime, (home) => ({
      orchestrator: {
        projects: createFsProjectStore({ homeDir: home }),
        approvals: createFsBudgetApprovalStore({ homeDir: home }),
        audit: createFsAuditLogStore({ homeDir: home }),
      },
      createLatexCompiler: () => fakeCompiler,
    }));

    const store = createFsProjectStore({ homeDir });
    const base = createResearchProject({
      projectId: "p1",
      title: "Demo",
      topic: "graph rag",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
      lifecycle: "active",
      phase: phaseForStep("step9_result_validation"),
      step: "step9_result_validation",
    });
    await store.init({ ...base, gates: { ...base.gates, experimentCompleted: true } });

    logs.length = 0;
    await program.parseAsync(
      [
        "research",
        "validate",
        "--project-id",
        "p1",
        "--summary",
        "ok",
        "--home",
        homeDir,
        "--json",
      ],
      { from: "user" },
    );
    const validated = lastJson<{ step: string; gates: { resultsVerified: boolean } }>(logs);
    expect(validated.step).toBe("step10_paper_writing");
    expect(validated.gates.resultsVerified).toBe(true);

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
    const wrote = lastJson<{
      draft: { draftId: string; mainTexPath: string; refsBibPath: string };
    }>(logs);
    expect(wrote.draft.draftId).toBe("d1");
    expect(wrote.draft.mainTexPath).toContain("main.tex");
    expect(wrote.draft.refsBibPath).toContain("refs.bib");

    const reviewsPath = path.join(homeDir, "reviews.json");
    const reviews = [
      createPeerReview({
        reviewId: "r1",
        projectId: "p1",
        draftId: "d1",
        reviewerId: "reviewer-1",
        persona: "theory",
        createdAt: "2026-03-11T00:00:00.000Z",
        rubric: createRubric(8),
        summary: "ok",
        recommendation: "accept",
      }),
      createPeerReview({
        reviewId: "r2",
        projectId: "p1",
        draftId: "d1",
        reviewerId: "reviewer-2",
        persona: "experimental",
        createdAt: "2026-03-11T00:00:00.000Z",
        rubric: createRubric(8),
        summary: "ok",
        recommendation: "accept",
      }),
      createPeerReview({
        reviewId: "r3",
        projectId: "p1",
        draftId: "d1",
        reviewerId: "reviewer-3",
        persona: "application",
        createdAt: "2026-03-11T00:00:00.000Z",
        rubric: createRubric(8),
        summary: "ok",
        recommendation: "accept",
      }),
    ];
    await fs.writeFile(reviewsPath, JSON.stringify(reviews, null, 2), "utf8");

    logs.length = 0;
    await program.parseAsync(
      [
        "research",
        "paper",
        "compile",
        "--project-id",
        "p1",
        "--draft-id",
        "d1",
        "--home",
        homeDir,
        "--json",
      ],
      { from: "user" },
    );
    const compiled = lastJson<{ project: { step: string } }>(logs);
    expect(compiled.project.step).toBe("step11_peer_review");

    logs.length = 0;
    await program.parseAsync(
      [
        "research",
        "review",
        "decide",
        "--project-id",
        "p1",
        "--draft-id",
        "d1",
        "--reviews",
        reviewsPath,
        "--home",
        homeDir,
        "--json",
      ],
      { from: "user" },
    );
    const decided = lastJson<{ project: { step: string }; decision: { verdict: string } }>(logs);
    expect(decided.decision.verdict).toBe("accept");
    expect(decided.project.step).toBe("step12_human_final");
  });
});
