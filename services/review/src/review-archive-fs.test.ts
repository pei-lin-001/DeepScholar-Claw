import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createPeerReview,
  createResearchProject,
  createReviewRubric,
  type ReviewDecision,
  type ReviewDimensionAssessment,
} from "@deepscholar/contracts";
import { describe, expect, it } from "vitest";
import { createFsReviewArchiveStore } from "./review-archive-fs.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-review-archive-"));
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

function createReview(reviewId: string, reviewerId: string) {
  return createPeerReview({
    reviewId,
    projectId: "p1",
    draftId: "d1",
    reviewerId,
    persona: "theory",
    createdAt: "2026-03-12T00:00:00.000Z",
    rubric: createRubric(8),
    summary: "solid",
    strengths: ["clear"],
    weaknesses: ["small scale"],
    questions: [],
    recommendation: "accept",
  });
}

function createDecision(): ReviewDecision {
  return {
    decisionId: "dec-1",
    projectId: "p1",
    draftId: "d1",
    decidedAt: "2026-03-12T00:00:10.000Z",
    verdict: "accept",
    averageScore: 8,
    scoreSpread: 0,
    debateTriggered: false,
    summary: "accepted",
  };
}

describe("review archive fs", () => {
  it("writes reviewer files and marks writeback as applied", async () => {
    const homeDir = await createTempDir();
    const store = createFsReviewArchiveStore({ homeDir });
    const reviews = [
      createReview("r1", "reviewer-1"),
      createReview("r2", "reviewer-2"),
      createReview("r3", "reviewer-3"),
    ];

    const archived = await store.archiveRound({
      projectId: "p1",
      draftId: "d1",
      reviews,
      decision: createDecision(),
    });
    expect(archived.round.roundId).toBe("round_1");
    expect(archived.reviewerPaths).toHaveLength(3);

    const pendingMeta = JSON.parse(await fs.readFile(archived.paths.metaReviewPath, "utf8")) as {
      writeback: { status: string };
    };
    expect(pendingMeta.writeback.status).toBe("pending");

    const project = createResearchProject({
      projectId: "p1",
      title: "Demo",
      topic: "graph rag",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
      lifecycle: "active",
      phase: "handoff",
      step: "step12_human_final",
    });
    const applied = await store.markRoundApplied("p1", "round_1", project);
    const appliedMeta = JSON.parse(await fs.readFile(applied.paths.metaReviewPath, "utf8")) as {
      writeback: { status: string; projectStep: string };
    };
    expect(appliedMeta.writeback.status).toBe("applied");
    expect(appliedMeta.writeback.projectStep).toBe("step12_human_final");
  });
});
