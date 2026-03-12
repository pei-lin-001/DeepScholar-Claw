import {
  REVIEWER_PERSONAS,
  REVIEW_VERDICTS,
  validateReviewRubric,
  type ReviewerPersona,
  type ReviewRubric,
  type ReviewVerdict,
} from "./review-rubric.ts";
import { isIsoTimestamp, type IsoTimestamp } from "./time.ts";
import {
  isFiniteNumber,
  isNonEmptyText,
  isOneOf,
  pushIf,
  uniqueStrings,
  type ValidationIssue,
} from "./validation.ts";

export * from "./review-rubric.ts";

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

const REVIEW_SCORE_MIN = 1;
const REVIEW_SCORE_MAX = 10;

function requireNonEmptyText(
  issues: ValidationIssue[],
  value: unknown,
  field: string,
  message: string,
): void {
  if (typeof value !== "string") {
    issues.push({ field, message });
    return;
  }
  pushIf(issues, !isNonEmptyText(value), field, message);
}

function requireIsoTimestamp(
  issues: ValidationIssue[],
  value: unknown,
  field: string,
  message: string,
): void {
  if (typeof value !== "string") {
    issues.push({ field, message });
    return;
  }
  pushIf(issues, !isIsoTimestamp(value), field, message);
}

function requireOneOf<T extends string>(
  issues: ValidationIssue[],
  value: unknown,
  allowed: readonly T[],
  field: string,
  message: string,
): void {
  if (typeof value !== "string") {
    issues.push({ field, message });
    return;
  }
  pushIf(issues, !isOneOf(value, allowed), field, message);
}

function validateTextArray(values: unknown, field: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!Array.isArray(values)) {
    issues.push({ field, message: "必须是字符串数组" });
    return issues;
  }
  for (const [idx, value] of values.entries()) {
    if (typeof value !== "string") {
      issues.push({ field: `${field}[${idx}]`, message: "内容必须是字符串" });
      continue;
    }
    pushIf(issues, !isNonEmptyText(value), `${field}[${idx}]`, "内容不能为空");
  }
  return issues;
}

export function validatePeerReview(review: PeerReview): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  requireNonEmptyText(issues, review.reviewId, "reviewId", "reviewId 不能为空");
  requireNonEmptyText(issues, review.projectId, "projectId", "projectId 不能为空");
  requireNonEmptyText(issues, review.draftId, "draftId", "draftId 不能为空");
  requireNonEmptyText(issues, review.reviewerId, "reviewerId", "reviewerId 不能为空");
  requireOneOf(
    issues,
    review.persona,
    REVIEWER_PERSONAS,
    "persona",
    `persona 必须是 ${REVIEWER_PERSONAS.join("/")}`,
  );
  requireIsoTimestamp(issues, review.createdAt, "createdAt", "createdAt 必须是合法时间戳");
  requireNonEmptyText(issues, review.summary, "summary", "summary 不能为空");
  requireOneOf(
    issues,
    review.recommendation,
    REVIEW_VERDICTS,
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
  pushIf(
    issues,
    typeof decision.decisionId !== "string" || !isNonEmptyText(decision.decisionId),
    "decisionId",
    "decisionId 不能为空",
  );
  pushIf(
    issues,
    typeof decision.projectId !== "string" || !isNonEmptyText(decision.projectId),
    "projectId",
    "projectId 不能为空",
  );
  pushIf(
    issues,
    typeof decision.draftId !== "string" || !isNonEmptyText(decision.draftId),
    "draftId",
    "draftId 不能为空",
  );
  pushIf(
    issues,
    typeof decision.decidedAt !== "string" || !isIsoTimestamp(decision.decidedAt),
    "decidedAt",
    "decidedAt 必须是合法时间戳",
  );
  pushIf(
    issues,
    typeof decision.verdict !== "string" || !isOneOf(decision.verdict, REVIEW_VERDICTS),
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
  pushIf(
    issues,
    typeof round.roundId !== "string" || !isNonEmptyText(round.roundId),
    "roundId",
    "roundId 不能为空",
  );
  pushIf(
    issues,
    typeof round.projectId !== "string" || !isNonEmptyText(round.projectId),
    "projectId",
    "projectId 不能为空",
  );
  pushIf(
    issues,
    typeof round.draftId !== "string" || !isNonEmptyText(round.draftId),
    "draftId",
    "draftId 不能为空",
  );
  pushIf(
    issues,
    typeof round.createdAt !== "string" || !isIsoTimestamp(round.createdAt),
    "createdAt",
    "createdAt 必须是合法时间戳",
  );
  if (!Array.isArray(round.reviews)) {
    issues.push({ field: "reviews", message: "reviews 必须是数组" });
    return issues;
  }
  for (const review of round.reviews) {
    issues.push(...validatePeerReview(review));
  }
  issues.push(...validateReviewDecision(round.decision));
  return issues;
}
