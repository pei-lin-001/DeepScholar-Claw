import { createPeerReview, createReviewRubric } from "@deepscholar/contracts";
import { describe, expect, it } from "vitest";
import { aggregateReviews } from "./review-aggregation.ts";

function rubric(totalScore: number) {
  return createReviewRubric({
    dimensions: {
      originality: { score: totalScore, evidence: "sec1" },
      soundness: { score: totalScore, evidence: "sec2" },
      experimentalRigor: { score: totalScore, evidence: "sec3" },
      clarity: { score: totalScore, evidence: "sec4" },
      relatedWorkCompleteness: { score: totalScore, evidence: "sec5" },
      practicalImpact: { score: totalScore, evidence: "sec6" },
      ethicsAndReproducibility: { score: totalScore, evidence: "sec7" },
    },
  });
}

function review(id: string, totalScore: number) {
  return createPeerReview({
    reviewId: id,
    projectId: "p1",
    draftId: "d1",
    reviewerId: id,
    persona: "experimental",
    createdAt: "2026-03-11T00:00:00.000Z",
    rubric: rubric(totalScore),
    summary: "ok",
    recommendation: "accept",
  });
}

describe("review aggregation", () => {
  it("requires 3 reviewers by default", () => {
    expect(() =>
      aggregateReviews([review("r1", 7), review("r2", 7)], { decisionId: "dec" }),
    ).toThrow(/评审数量不符合预期/);
  });

  it("decides accept/minor/major/reject by average score", () => {
    expect(
      aggregateReviews([review("r1", 8), review("r2", 8), review("r3", 8)], { decisionId: "dec-1" })
        .decision.verdict,
    ).toBe("accept");

    expect(
      aggregateReviews([review("r1", 6), review("r2", 6), review("r3", 6)], { decisionId: "dec-2" })
        .decision.verdict,
    ).toBe("minor_revision");

    expect(
      aggregateReviews([review("r1", 4.5), review("r2", 4.5), review("r3", 4.5)], {
        decisionId: "dec-3",
      }).decision.verdict,
    ).toBe("major_revision");

    expect(
      aggregateReviews([review("r1", 3), review("r2", 3), review("r3", 3)], { decisionId: "dec-4" })
        .decision.verdict,
    ).toBe("reject");
  });

  it("triggers debate when spread is too large", () => {
    const result = aggregateReviews([review("r1", 9), review("r2", 5), review("r3", 5)], {
      decisionId: "dec-5",
    });
    expect(result.debateTriggered).toBe(true);
    expect(result.decision.debateTriggered).toBe(true);
    expect(result.decision.scoreSpread).toBeGreaterThan(3);
  });
});
