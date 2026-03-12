import os from "node:os";
import path from "node:path";
import { safeIdForFileName } from "@deepscholar/contracts";

export type DeepScholarHome = {
  readonly rootDir: string;
};

export type ReviewProjectPaths = {
  readonly projectDir: string;
  readonly reviewsDir: string;
};

export type ReviewRoundPaths = {
  readonly roundId: string;
  readonly roundDir: string;
  readonly metaReviewPath: string;
};

export function resolveDeepScholarHome(rootDir?: string): DeepScholarHome {
  const resolved = rootDir ?? path.join(os.homedir(), ".deepscholar");
  return { rootDir: resolved };
}

export function resolveReviewProjectPaths(
  home: DeepScholarHome,
  projectId: string,
): ReviewProjectPaths {
  const safeProjectId = safeIdForFileName(projectId, "projectId");
  const projectDir = path.join(home.rootDir, "projects", safeProjectId);
  return {
    projectDir,
    reviewsDir: path.join(projectDir, "reviews"),
  };
}

export function resolveReviewRoundPaths(
  projectPaths: ReviewProjectPaths,
  roundId: string,
): ReviewRoundPaths {
  const safeRoundId = safeIdForFileName(roundId, "roundId");
  const roundDir = path.join(projectPaths.reviewsDir, safeRoundId);
  return {
    roundId: safeRoundId,
    roundDir,
    metaReviewPath: path.join(roundDir, "meta_review.json"),
  };
}

export function reviewerPath(roundDir: string, index: number): string {
  return path.join(roundDir, `reviewer_${index + 1}.json`);
}
