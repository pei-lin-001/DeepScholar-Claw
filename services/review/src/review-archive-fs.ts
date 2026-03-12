import fs from "node:fs/promises";
import {
  nowIsoTimestamp,
  validateReviewRound,
  type PeerReview,
  type ResearchProject,
  type ReviewDecision,
  type ReviewRound,
} from "@deepscholar/contracts";
import {
  resolveDeepScholarHome,
  resolveReviewProjectPaths,
  resolveReviewRoundPaths,
  reviewerPath,
  type DeepScholarHome,
  type ReviewRoundPaths,
} from "./review-paths.ts";

export type FsReviewArchiveOptions = {
  readonly homeDir?: string;
  readonly home?: DeepScholarHome;
};

export type ReviewWritebackRecord = {
  readonly status: "pending" | "applied";
  readonly appliedAt?: string;
  readonly projectStep?: ResearchProject["step"];
  readonly projectLifecycle?: ResearchProject["lifecycle"];
};

export type StoredReviewRound = {
  readonly round: ReviewRound;
  readonly paths: ReviewRoundPaths;
  readonly reviewerPaths: readonly string[];
  readonly writeback: ReviewWritebackRecord;
};

export type ReviewArchiveStore = {
  archiveRound: (input: {
    readonly projectId: string;
    readonly draftId: string;
    readonly reviews: readonly PeerReview[];
    readonly decision: ReviewDecision;
  }) => Promise<StoredReviewRound>;
  markRoundApplied: (
    projectId: string,
    roundId: string,
    project: ResearchProject,
  ) => Promise<StoredReviewRound>;
};

function issueSummary(round: ReviewRound): string {
  return validateReviewRound(round)
    .map((issue) => `${issue.field}:${issue.message}`)
    .join(", ");
}

async function nextRoundId(reviewsDir: string): Promise<string> {
  try {
    const entries = await fs.readdir(reviewsDir, { withFileTypes: true });
    const ordinals = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => /^round_(\d+)$/.exec(entry.name)?.[1])
      .filter((value): value is string => value !== undefined)
      .map((value) => Number(value))
      .filter(Number.isInteger);
    const next = ordinals.length === 0 ? 1 : Math.max(...ordinals) + 1;
    return `round_${next}`;
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return "round_1";
    }
    throw err;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await fs.writeFile(path, JSON.stringify(value, null, 2), "utf8");
}

function buildStoredRound(
  round: ReviewRound,
  paths: ReviewRoundPaths,
  writeback: ReviewWritebackRecord,
): StoredReviewRound {
  return {
    round,
    paths,
    reviewerPaths: round.reviews.map((_, index) => reviewerPath(paths.roundDir, index)),
    writeback,
  };
}

export function createFsReviewArchiveStore(
  options: FsReviewArchiveOptions = {},
): ReviewArchiveStore {
  const home = options.home ?? resolveDeepScholarHome(options.homeDir);

  async function archiveRound(input: {
    readonly projectId: string;
    readonly draftId: string;
    readonly reviews: readonly PeerReview[];
    readonly decision: ReviewDecision;
  }): Promise<StoredReviewRound> {
    const projectPaths = resolveReviewProjectPaths(home, input.projectId);
    const roundId = await nextRoundId(projectPaths.reviewsDir);
    const paths = resolveReviewRoundPaths(projectPaths, roundId);
    const round: ReviewRound = {
      roundId,
      projectId: input.projectId,
      draftId: input.draftId,
      createdAt: input.decision.decidedAt,
      reviews: input.reviews,
      decision: input.decision,
    };
    const issues = validateReviewRound(round);
    if (issues.length > 0) {
      throw new Error(`ReviewRound 校验失败: ${issueSummary(round)}`);
    }

    await fs.mkdir(paths.roundDir, { recursive: true });
    await Promise.all(
      round.reviews.map((review, index) => writeJson(reviewerPath(paths.roundDir, index), review)),
    );
    const writeback: ReviewWritebackRecord = { status: "pending" };
    await writeJson(paths.metaReviewPath, {
      ...round,
      reviewFiles: round.reviews.map((_, index) => `reviewer_${index + 1}.json`),
      writeback,
    });
    return buildStoredRound(round, paths, writeback);
  }

  async function markRoundApplied(
    projectId: string,
    roundId: string,
    project: ResearchProject,
  ): Promise<StoredReviewRound> {
    const projectPaths = resolveReviewProjectPaths(home, projectId);
    const paths = resolveReviewRoundPaths(projectPaths, roundId);
    const raw = JSON.parse(await fs.readFile(paths.metaReviewPath, "utf8")) as ReviewRound & {
      readonly writeback?: ReviewWritebackRecord;
    };
    const round: ReviewRound = {
      roundId: raw.roundId,
      projectId: raw.projectId,
      draftId: raw.draftId,
      createdAt: raw.createdAt,
      reviews: raw.reviews,
      decision: raw.decision,
    };
    const issues = validateReviewRound(round);
    if (issues.length > 0) {
      throw new Error(`meta_review.json 不是合法 ReviewRound: ${issueSummary(round)}`);
    }

    const writeback: ReviewWritebackRecord = {
      status: "applied",
      appliedAt: nowIsoTimestamp(),
      projectStep: project.step,
      projectLifecycle: project.lifecycle,
    };
    await writeJson(paths.metaReviewPath, {
      ...round,
      reviewFiles: round.reviews.map((_, index) => `reviewer_${index + 1}.json`),
      writeback,
    });
    return buildStoredRound(round, paths, writeback);
  }

  return { archiveRound, markRoundApplied };
}
