import {
  isFiniteNumber,
  isNonEmptyText,
  isOneOf,
  pushIf,
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
  assessment: unknown,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!assessment || typeof assessment !== "object") {
    issues.push({
      field: `dimensions.${dimension}`,
      message: "该维度缺失或不是对象",
    });
    return issues;
  }

  const raw = assessment as { score?: unknown; evidence?: unknown };
  const score = typeof raw.score === "number" ? raw.score : Number.NaN;
  const evidence = typeof raw.evidence === "string" ? raw.evidence : "";

  pushIf(
    issues,
    !isFiniteNumber(score) || score < REVIEW_SCORE_MIN || score > REVIEW_SCORE_MAX,
    `dimensions.${dimension}.score`,
    `score 必须在 ${REVIEW_SCORE_MIN}-${REVIEW_SCORE_MAX} 范围内`,
  );
  pushIf(
    issues,
    !isNonEmptyText(evidence),
    `dimensions.${dimension}.evidence`,
    "evidence 不能为空",
  );
  return issues;
}

export function validateReviewRubric(rubric: ReviewRubric): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!rubric || typeof rubric !== "object") {
    issues.push({ field: "rubric", message: "rubric 缺失或不是对象" });
    return issues;
  }

  const raw = rubric as unknown as {
    thresholds?: unknown;
    totalScore?: unknown;
    dimensions?: unknown;
  };

  if (!raw.thresholds || typeof raw.thresholds !== "object") {
    issues.push({ field: "thresholds", message: "thresholds 缺失或不是对象" });
  } else {
    issues.push(...validateThresholds(raw.thresholds as ReviewThresholds));
  }

  const totalScore = typeof raw.totalScore === "number" ? raw.totalScore : Number.NaN;
  pushIf(
    issues,
    !isFiniteNumber(totalScore) || totalScore < REVIEW_SCORE_MIN || totalScore > REVIEW_SCORE_MAX,
    "totalScore",
    `totalScore 必须在 ${REVIEW_SCORE_MIN}-${REVIEW_SCORE_MAX} 范围内`,
  );

  if (!raw.dimensions || typeof raw.dimensions !== "object") {
    issues.push({ field: "dimensions", message: "dimensions 缺失或不是对象" });
    return issues;
  }

  const dimensions = raw.dimensions as Record<string, unknown>;
  for (const dimension of REVIEW_DIMENSIONS) {
    issues.push(...validateDimensionAssessment(dimension, dimensions[dimension]));
  }
  return issues;
}
