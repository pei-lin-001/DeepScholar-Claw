import { isIsoTimestamp, type IsoTimestamp } from "./time.ts";
import {
  isFiniteNumber,
  isNonEmptyText,
  isOneOf,
  pushIf,
  uniqueStrings,
  type ValidationIssue,
} from "./validation.ts";

export type ReviewerPersona = "theory" | "experimental" | "application";

export const REVIEWER_PERSONAS: readonly ReviewerPersona[] = [
  "theory",
  "experimental",
  "application",
];

export function isReviewerPersona(value: string): value is ReviewerPersona {
  return isOneOf(value, REVIEWER_PERSONAS);
}

export type ReviewVerdict = "accept" | "minor_revision" | "major_revision" | "reject";

export const REVIEW_VERDICTS: readonly ReviewVerdict[] = [
  "accept",
  "minor_revision",
  "major_revision",
  "reject",
];

export function isReviewVerdict(value: string): value is ReviewVerdict {
  return isOneOf(value, REVIEW_VERDICTS);
}

export type ReviewDimensionId =
  | "originality"
  | "soundness"
  | "experimentalRigor"
  | "clarity"
  | "relatedWorkCompleteness"
  | "practicalImpact"
  | "ethicsAndReproducibility";

export const REVIEW_DIMENSIONS: readonly ReviewDimensionId[] = [
  "originality",
  "soundness",
  "experimentalRigor",
  "clarity",
  "relatedWorkCompleteness",
  "practicalImpact",
  "ethicsAndReproducibility",
];

export function isReviewDimensionId(value: string): value is ReviewDimensionId {
  return isOneOf(value, REVIEW_DIMENSIONS);
}

export type ReviewThresholds = {
  readonly accept: number;
  readonly minorRevision: number;
  readonly majorRevision: number;
  readonly reject: number;
};

export const DEFAULT_REVIEW_THRESHOLDS: ReviewThresholds = {
  accept: 7,
  minorRevision: 5.5,
  majorRevision: 4,
  reject: 0,
};

export type ReviewDimensionAssessment = {
  readonly score: number;
  readonly evidence: string;
};

export type ReviewRubric = {
  readonly dimensions: Readonly<Record<ReviewDimensionId, ReviewDimensionAssessment>>;
  readonly totalScore: number;
  readonly thresholds: ReviewThresholds;
};

export type CreateReviewRubricInput = {
  readonly dimensions: Readonly<Record<ReviewDimensionId, ReviewDimensionAssessment>>;
  readonly thresholds?: ReviewThresholds;
  readonly totalScore?: number;
};

const REVIEW_SCORE_MIN = 1;
const REVIEW_SCORE_MAX = 10;

function mean(numbers: readonly number[]): number {
  if (numbers.length === 0) {
    return 0;
  }
  const sum = numbers.reduce((acc, value) => acc + value, 0);
  return sum / numbers.length;
}

function scoresFromDimensions(
  dimensions: Readonly<Record<ReviewDimensionId, ReviewDimensionAssessment>>,
): number[] {
  return REVIEW_DIMENSIONS.map((dimension) => dimensions[dimension].score);
}

export function createReviewRubric(input: CreateReviewRubricInput): ReviewRubric {
  const thresholds = input.thresholds ?? DEFAULT_REVIEW_THRESHOLDS;
  const totalScore = input.totalScore ?? mean(scoresFromDimensions(input.dimensions));
  return { dimensions: input.dimensions, thresholds, totalScore };
}

export type PeerReview = {
  readonly reviewId: string;
  readonly projectId: string;
  readonly draftId: string;
  readonly reviewerId: string;
  readonly persona: ReviewerPersona;
  readonly createdAt: IsoTimestamp;
  readonly rubric: ReviewRubric;
  readonly summary: string;
  readonly strengths: readonly string[];
  readonly weaknesses: readonly string[];
  readonly questions: readonly string[];
  readonly recommendation: ReviewVerdict;
};

export type CreatePeerReviewInput = {
  readonly reviewId: string;
  readonly projectId: string;
  readonly draftId: string;
  readonly reviewerId: string;
  readonly persona: ReviewerPersona;
  readonly createdAt: IsoTimestamp;
  readonly rubric: ReviewRubric;
  readonly summary: string;
  readonly strengths?: readonly string[];
  readonly weaknesses?: readonly string[];
  readonly questions?: readonly string[];
  readonly recommendation: ReviewVerdict;
};

export function createPeerReview(input: CreatePeerReviewInput): PeerReview {
  return {
    reviewId: input.reviewId,
    projectId: input.projectId,
    draftId: input.draftId,
    reviewerId: input.reviewerId,
    persona: input.persona,
    createdAt: input.createdAt,
    rubric: input.rubric,
    summary: input.summary,
    strengths: uniqueStrings(input.strengths ?? []),
    weaknesses: uniqueStrings(input.weaknesses ?? []),
    questions: uniqueStrings(input.questions ?? []),
    recommendation: input.recommendation,
  };
}

export type ReviewDecision = {
  readonly decisionId: string;
  readonly projectId: string;
  readonly draftId: string;
  readonly decidedAt: IsoTimestamp;
  readonly verdict: ReviewVerdict;
  readonly averageScore: number;
  readonly scoreSpread: number;
  readonly debateTriggered: boolean;
  readonly summary: string;
};

export type ReviewRound = {
  readonly roundId: string;
  readonly projectId: string;
  readonly draftId: string;
  readonly createdAt: IsoTimestamp;
  readonly reviews: readonly PeerReview[];
  readonly decision: ReviewDecision;
};

function validateThresholds(thresholds: ReviewThresholds): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isFiniteNumber(thresholds.accept), "thresholds.accept", "accept 必须是数字");
  pushIf(
    issues,
    !isFiniteNumber(thresholds.minorRevision),
    "thresholds.minorRevision",
    "minorRevision 必须是数字",
  );
  pushIf(
    issues,
    !isFiniteNumber(thresholds.majorRevision),
    "thresholds.majorRevision",
    "majorRevision 必须是数字",
  );
  pushIf(issues, !isFiniteNumber(thresholds.reject), "thresholds.reject", "reject 必须是数字");

  pushIf(
    issues,
    thresholds.accept < thresholds.minorRevision ||
      thresholds.minorRevision < thresholds.majorRevision ||
      thresholds.majorRevision < thresholds.reject,
    "thresholds",
    "阈值必须满足 accept >= minorRevision >= majorRevision >= reject",
  );
  return issues;
}

function validateDimensionAssessment(
  dimension: ReviewDimensionId,
  assessment: ReviewDimensionAssessment,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(
    issues,
    !isFiniteNumber(assessment.score) ||
      assessment.score < REVIEW_SCORE_MIN ||
      assessment.score > REVIEW_SCORE_MAX,
    `dimensions.${dimension}.score`,
    `score 必须在 ${REVIEW_SCORE_MIN}-${REVIEW_SCORE_MAX} 范围内`,
  );
  pushIf(
    issues,
    !isNonEmptyText(assessment.evidence),
    `dimensions.${dimension}.evidence`,
    "evidence 不能为空",
  );
  return issues;
}

export function validateReviewRubric(rubric: ReviewRubric): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  issues.push(...validateThresholds(rubric.thresholds));
  pushIf(
    issues,
    !isFiniteNumber(rubric.totalScore) ||
      rubric.totalScore < REVIEW_SCORE_MIN ||
      rubric.totalScore > REVIEW_SCORE_MAX,
    "totalScore",
    `totalScore 必须在 ${REVIEW_SCORE_MIN}-${REVIEW_SCORE_MAX} 范围内`,
  );

  for (const dimension of REVIEW_DIMENSIONS) {
    issues.push(...validateDimensionAssessment(dimension, rubric.dimensions[dimension]));
  }
  return issues;
}

function validateTextArray(values: readonly string[], field: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const [idx, value] of values.entries()) {
    pushIf(issues, !isNonEmptyText(value), `${field}[${idx}]`, "内容不能为空");
  }
  return issues;
}

export function validatePeerReview(review: PeerReview): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(review.reviewId), "reviewId", "reviewId 不能为空");
  pushIf(issues, !isNonEmptyText(review.projectId), "projectId", "projectId 不能为空");
  pushIf(issues, !isNonEmptyText(review.draftId), "draftId", "draftId 不能为空");
  pushIf(issues, !isNonEmptyText(review.reviewerId), "reviewerId", "reviewerId 不能为空");
  pushIf(
    issues,
    !isOneOf(review.persona, REVIEWER_PERSONAS),
    "persona",
    `persona 必须是 ${REVIEWER_PERSONAS.join("/")}`,
  );
  pushIf(issues, !isIsoTimestamp(review.createdAt), "createdAt", "createdAt 必须是合法时间戳");
  pushIf(issues, !isNonEmptyText(review.summary), "summary", "summary 不能为空");
  pushIf(
    issues,
    !isOneOf(review.recommendation, REVIEW_VERDICTS),
    "recommendation",
    `recommendation 必须是 ${REVIEW_VERDICTS.join("/")}`,
  );
  issues.push(...validateReviewRubric(review.rubric));
  issues.push(...validateTextArray(review.strengths, "strengths"));
  issues.push(...validateTextArray(review.weaknesses, "weaknesses"));
  issues.push(...validateTextArray(review.questions, "questions"));
  return issues;
}

export function validateReviewDecision(decision: ReviewDecision): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(decision.decisionId), "decisionId", "decisionId 不能为空");
  pushIf(issues, !isNonEmptyText(decision.projectId), "projectId", "projectId 不能为空");
  pushIf(issues, !isNonEmptyText(decision.draftId), "draftId", "draftId 不能为空");
  pushIf(issues, !isIsoTimestamp(decision.decidedAt), "decidedAt", "decidedAt 必须是合法时间戳");
  pushIf(
    issues,
    !isOneOf(decision.verdict, REVIEW_VERDICTS),
    "verdict",
    `verdict 必须是 ${REVIEW_VERDICTS.join("/")}`,
  );
  pushIf(
    issues,
    !isFiniteNumber(decision.averageScore) ||
      decision.averageScore < REVIEW_SCORE_MIN ||
      decision.averageScore > REVIEW_SCORE_MAX,
    "averageScore",
    `averageScore 必须在 ${REVIEW_SCORE_MIN}-${REVIEW_SCORE_MAX} 范围内`,
  );
  pushIf(
    issues,
    !isFiniteNumber(decision.scoreSpread) || decision.scoreSpread < 0,
    "scoreSpread",
    "scoreSpread 必须是非负数",
  );
  pushIf(issues, !isNonEmptyText(decision.summary), "summary", "summary 不能为空");
  return issues;
}

export function validateReviewRound(round: ReviewRound): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(round.roundId), "roundId", "roundId 不能为空");
  pushIf(issues, !isNonEmptyText(round.projectId), "projectId", "projectId 不能为空");
  pushIf(issues, !isNonEmptyText(round.draftId), "draftId", "draftId 不能为空");
  pushIf(issues, !isIsoTimestamp(round.createdAt), "createdAt", "createdAt 必须是合法时间戳");
  for (const review of round.reviews) {
    issues.push(...validatePeerReview(review));
  }
  issues.push(...validateReviewDecision(round.decision));
  return issues;
}
