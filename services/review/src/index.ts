import { pathToFileURL } from "node:url";
import type { ServiceDescriptor } from "@deepscholar/contracts";

export {
  DEFAULT_REVIEW_AGGREGATION_POLICY,
  aggregateReviews,
  type AggregateReviewsResult,
  type ReviewAggregationPolicy,
} from "./review-aggregation.ts";
export {
  createFsReviewArchiveStore,
  type FsReviewArchiveOptions,
  type ReviewArchiveStore,
  type ReviewWritebackRecord,
  type StoredReviewRound,
} from "./review-archive-fs.ts";
export {
  resolveDeepScholarHome,
  resolveReviewProjectPaths,
  resolveReviewRoundPaths,
  reviewerPath,
  type DeepScholarHome,
  type ReviewProjectPaths,
  type ReviewRoundPaths,
} from "./review-paths.ts";

export const reviewService: ServiceDescriptor = {
  id: "review",
  displayName: "Peer Review",
  owns: [
    "structured scoring rubric",
    "meta review aggregation",
    "dispute gate decision",
    "review round archival",
  ],
  consumes: ["paper draft bundle"],
  produces: ["review decision", "revision directives", "debate trigger", "review round archive"],
  outOfScope: ["real conference submission", "full debate orchestration"],
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  console.log(JSON.stringify(reviewService, null, 2));
}
