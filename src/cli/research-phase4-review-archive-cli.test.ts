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

describe("research phase4 review archive CLI", () => {
  it("archives peer reviews into project reviews directory during review decide", async () => {
    const homeDir = await createTempDir("deepscholar-phase4-review-archive-");
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

    const reviews = [
      createPeerReview({
        reviewId: "r1",
        projectId: "p1",
        draftId: "d1",
        reviewerId: "reviewer-1",
        persona: "theory",
        createdAt: "2026-03-12T00:00:00.000Z",
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
        createdAt: "2026-03-12T00:00:00.000Z",
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
        createdAt: "2026-03-12T00:00:00.000Z",
        rubric: createRubric(8),
        summary: "ok",
        recommendation: "accept",
      }),
    ];
    const reviewsPath = path.join(homeDir, "reviews.json");
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

    const decided = lastJson<{
      reviewArchive: {
        roundId: string;
        roundDir: string;
        metaReviewPath: string;
        reviewerPaths: readonly string[];
      };
      project: { step: string };
    }>(logs);
    expect(decided.project.step).toBe("step12_human_final");
    expect(decided.reviewArchive.roundId).toBe("round_1");
    expect(decided.reviewArchive.reviewerPaths).toHaveLength(3);

    const meta = JSON.parse(await fs.readFile(decided.reviewArchive.metaReviewPath, "utf8")) as {
      writeback: { status: string; projectStep: string };
    };
    expect(meta.writeback.status).toBe("applied");
    expect(meta.writeback.projectStep).toBe("step12_human_final");
  });
});
