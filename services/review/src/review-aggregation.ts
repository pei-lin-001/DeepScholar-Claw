import {
  DEFAULT_REVIEW_THRESHOLDS,
  nowIsoTimestamp,
  validatePeerReview,
  validateReviewDecision,
  type PeerReview,
  type ReviewDecision,
  type ReviewThresholds,
  type ReviewVerdict,
} from "@deepscholar/contracts";

export type ReviewAggregationPolicy = {
  readonly thresholds: ReviewThresholds;
  readonly disputeSpreadThreshold: number;
  readonly expectedReviewerCount: number;
};

export const DEFAULT_REVIEW_AGGREGATION_POLICY: ReviewAggregationPolicy = {
  thresholds: DEFAULT_REVIEW_THRESHOLDS,
  disputeSpreadThreshold: 3,
  expectedReviewerCount: 3,
};

export type AggregateReviewsResult = {
  readonly decision: ReviewDecision;
  readonly debateTriggered: boolean;
  readonly scoreSpread: number;
};

function mean(numbers: readonly number[]): number {
  if (numbers.length === 0) {
    return 0;
  }
  return numbers.reduce((acc, value) => acc + value, 0) / numbers.length;
}

function verdictForScore(score: number, thresholds: ReviewThresholds): ReviewVerdict {
  if (score >= thresholds.accept) {
    return "accept";
  }
  if (score >= thresholds.minorRevision) {
    return "minor_revision";
  }
  if (score >= thresholds.majorRevision) {
    return "major_revision";
  }
  return "reject";
}

function spread(scores: readonly number[]): number {
  if (scores.length === 0) {
    return 0;
  }
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  return max - min;
}

function issueSummary(reviews: readonly PeerReview[]): string {
  return reviews
    .flatMap((review) => validatePeerReview(review))
    .map((issue) => `${issue.field}:${issue.message}`)
    .join(", ");
}

export function aggregateReviews(
  reviews: readonly PeerReview[],
  input: { readonly decisionId: string; readonly policy?: ReviewAggregationPolicy },
): AggregateReviewsResult {
  const policy = input.policy ?? DEFAULT_REVIEW_AGGREGATION_POLICY;
  if (policy.expectedReviewerCount < 1) {
    throw new Error("expectedReviewerCount 必须 >= 1");
  }
  if (reviews.length !== policy.expectedReviewerCount) {
    throw new Error(
      `评审数量不符合预期: expected=${policy.expectedReviewerCount} actual=${reviews.length}`,
    );
  }

  const issues = issueSummary(reviews);
  if (issues.length > 0) {
    throw new Error(`PeerReview 校验失败，拒绝聚合: ${issues}`);
  }

  const projectId = reviews[0].projectId;
  const draftId = reviews[0].draftId;
  for (const review of reviews) {
    if (review.projectId !== projectId || review.draftId !== draftId) {
      throw new Error(
        `评审不属于同一项目/草稿: expected=${projectId}/${draftId} actual=${review.projectId}/${review.draftId} reviewId=${review.reviewId}`,
      );
    }
  }

  const totalScores = reviews.map((review) => review.rubric.totalScore);
  const averageScore = mean(totalScores);
  const scoreSpread = spread(totalScores);
  const debateTriggered = scoreSpread > policy.disputeSpreadThreshold;
  const verdict = verdictForScore(averageScore, policy.thresholds);

  const summary = debateTriggered
    ? `评分分歧过大(spread=${scoreSpread.toFixed(2)})，建议触发辩论后再定稿`
    : `平均分 ${averageScore.toFixed(2)}，裁决为 ${verdict}`;

  const decision: ReviewDecision = {
    decisionId: input.decisionId,
    projectId: reviews[0].projectId,
    draftId: reviews[0].draftId,
    decidedAt: nowIsoTimestamp(),
    verdict,
    averageScore,
    scoreSpread,
    debateTriggered,
    summary,
  };

  const decisionIssues = validateReviewDecision(decision);
  if (decisionIssues.length > 0) {
    throw new Error(
      `ReviewDecision 校验失败: ${decisionIssues.map((i) => `${i.field}:${i.message}`).join(", ")}`,
    );
  }

  return { decision, debateTriggered, scoreSpread };
}
