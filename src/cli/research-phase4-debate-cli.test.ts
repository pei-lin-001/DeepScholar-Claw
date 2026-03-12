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

describe("research phase4 debate CLI", () => {
  it("keeps the project paused on disputed reviews until debate-resolve is called", async () => {
    const homeDir = await createTempDir("deepscholar-phase4-debate-cli-");
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
      createLatexCompiler: vi.fn(),
    }));

    const store = createFsProjectStore({ homeDir });
    const project = createResearchProject({
      projectId: "p1",
      title: "Demo",
      topic: "graph rag",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
      lifecycle: "active",
      phase: phaseForStep("step11_peer_review"),
      step: "step11_peer_review",
    });
    await store.init({
      ...project,
      gates: { ...project.gates, resultsVerified: true, draftWritten: true },
    });

    const reviewsPath = path.join(homeDir, "debate-reviews.json");
    const reviews = [
      createPeerReview({
        reviewId: "r1",
        projectId: "p1",
        draftId: "d1",
        reviewerId: "reviewer-1",
        persona: "theory",
        createdAt: "2026-03-11T00:00:00.000Z",
        rubric: createRubric(10),
        summary: "strong accept",
        recommendation: "accept",
      }),
      createPeerReview({
        reviewId: "r2",
        projectId: "p1",
        draftId: "d1",
        reviewerId: "reviewer-2",
        persona: "experimental",
        createdAt: "2026-03-11T00:00:00.000Z",
        rubric: createRubric(3),
        summary: "serious doubts",
        recommendation: "major_revision",
      }),
      createPeerReview({
        reviewId: "r3",
        projectId: "p1",
        draftId: "d1",
        reviewerId: "reviewer-3",
        persona: "application",
        createdAt: "2026-03-11T00:00:00.000Z",
        rubric: createRubric(10),
        summary: "strong accept",
        recommendation: "accept",
      }),
    ];
    await fs.writeFile(reviewsPath, JSON.stringify(reviews, null, 2), "utf8");

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
    const held = lastJson<{
      decision: { verdict: string; debateTriggered: boolean };
      project: { step: string; lifecycle: string; gates: { reviewCompleted: boolean } };
    }>(logs);
    expect(held.decision.verdict).toBe("accept");
    expect(held.decision.debateTriggered).toBe(true);
    expect(held.project.step).toBe("step11_peer_review");
    expect(held.project.lifecycle).toBe("paused");
    expect(held.project.gates.reviewCompleted).toBe(false);

    logs.length = 0;
    await program.parseAsync(
      [
        "research",
        "review",
        "debate-resolve",
        "--project-id",
        "p1",
        "--draft-id",
        "d1",
        "--verdict",
        "accept",
        "--summary",
        "chair reviewed the disagreement and approved final accept",
        "--home",
        homeDir,
        "--json",
      ],
      { from: "user" },
    );
    const resolved = lastJson<{
      step: string;
      lifecycle: string;
      gates: { reviewCompleted: boolean };
    }>(logs);
    expect(resolved.step).toBe("step12_human_final");
    expect(resolved.lifecycle).toBe("active");
    expect(resolved.gates.reviewCompleted).toBe(true);
  });
});
