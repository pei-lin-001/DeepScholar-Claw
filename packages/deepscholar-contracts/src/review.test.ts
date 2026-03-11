import { describe, expect, it } from "vitest";
import {
  createPeerReview,
  createReviewRubric,
  validatePeerReview,
  validateReviewDecision,
  validateReviewRound,
  validateReviewRubric,
} from "./index.ts";

describe("review contracts", () => {
  function rubric(score: number) {
    return createReviewRubric({
      dimensions: {
        originality: { score, evidence: "sec1" },
        soundness: { score, evidence: "sec2" },
        experimentalRigor: { score, evidence: "sec3" },
        clarity: { score, evidence: "sec4" },
        relatedWorkCompleteness: { score, evidence: "sec5" },
        practicalImpact: { score, evidence: "sec6" },
        ethicsAndReproducibility: { score, evidence: "sec7" },
      },
    });
  }

  it("validates a complete peer review", () => {
    const review = createPeerReview({
      reviewId: "r1",
      projectId: "p1",
      draftId: "d1",
      reviewerId: "reviewer-1",
      persona: "experimental",
      createdAt: "2026-03-11T00:00:00.000Z",
      rubric: rubric(7),
      summary: "Solid work",
      strengths: ["clear idea"],
      weaknesses: ["needs ablation"],
      questions: ["where is code?"],
      recommendation: "minor_revision",
    });
    expect(validatePeerReview(review)).toEqual([]);
  });

  it("rejects invalid peer review values", () => {
    const review = createPeerReview({
      reviewId: "",
      projectId: "",
      draftId: "",
      reviewerId: "",
      persona: "nope" as never,
      createdAt: "bad" as never,
      rubric: rubric(0),
      summary: "",
      recommendation: "ok" as never,
      strengths: [""],
      weaknesses: [""],
      questions: [""],
    });
    expect(validatePeerReview(review).length).toBeGreaterThan(0);
  });

  it("validates decision and round", () => {
    const decision = {
      decisionId: "dec-1",
      projectId: "p1",
      draftId: "d1",
      decidedAt: "2026-03-11T00:00:10.000Z",
      verdict: "accept",
      averageScore: 8,
      scoreSpread: 1,
      debateTriggered: false,
      summary: "Accepted",
    } as const;
    expect(validateReviewDecision(decision)).toEqual([]);

    const round = {
      roundId: "round-1",
      projectId: "p1",
      draftId: "d1",
      createdAt: "2026-03-11T00:00:11.000Z",
      reviews: [
        createPeerReview({
          reviewId: "r1",
          projectId: "p1",
          draftId: "d1",
          reviewerId: "reviewer-1",
          persona: "theory",
          createdAt: "2026-03-11T00:00:00.000Z",
          rubric: rubric(7),
          summary: "ok",
          recommendation: "minor_revision",
        }),
      ],
      decision,
    } as const;
    expect(validateReviewRound(round)).toEqual([]);
  });

  it("reports missing rubric dimensions instead of throwing", () => {
    const full = rubric(7);
    const broken = { ...full, dimensions: { ...full.dimensions } } as Record<string, unknown>;
    const brokenDimensions = broken.dimensions as Record<string, unknown>;
    delete brokenDimensions.originality;
    broken.dimensions = brokenDimensions;

    const issues = validateReviewRubric(broken as never);
    expect(issues.map((issue) => issue.field)).toContain("dimensions.originality");
  });
});
