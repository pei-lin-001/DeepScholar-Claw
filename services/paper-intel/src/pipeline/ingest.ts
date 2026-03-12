import type { RawPaper } from "../sources/types.ts";
import type { PaperStore } from "../storage/paper-store.ts";
import { dedupePapers } from "./dedupe.ts";
import {
  filterPapersByQuality,
  type PaperQualityDecision,
  type PaperQualityPolicy,
} from "./quality-filter.ts";

export type IngestSummary = {
  readonly fetched: number;
  readonly duplicates: number;
  readonly kept: number;
  readonly dropped: number;
  readonly droppedByReason: Readonly<Record<string, number>>;
};

export type IngestResult = {
  readonly summary: IngestSummary;
  readonly keptPapers: readonly RawPaper[];
  readonly decisions: readonly PaperQualityDecision[];
};

function countDropReasons(
  decisions: readonly PaperQualityDecision[],
): Readonly<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const decision of decisions) {
    if (decision.keep) {
      continue;
    }
    for (const reason of decision.reasons) {
      counts[reason] = (counts[reason] ?? 0) + 1;
    }
  }
  return counts;
}

export async function ingestPapers(options: {
  readonly projectId: string;
  readonly papers: readonly RawPaper[];
  readonly policy: PaperQualityPolicy;
  readonly store: PaperStore;
}): Promise<IngestResult> {
  const { uniquePapers, duplicateCount } = dedupePapers(options.papers);
  const decisions = filterPapersByQuality(uniquePapers, options.policy);
  const kept = decisions.filter((decision) => decision.keep).map((decision) => decision.paper);

  for (const paper of kept) {
    await options.store.savePaper(options.projectId, paper);
  }

  return {
    summary: {
      fetched: options.papers.length,
      duplicates: duplicateCount,
      kept: kept.length,
      dropped: decisions.length - kept.length,
      droppedByReason: countDropReasons(decisions),
    },
    keptPapers: kept,
    decisions,
  };
}
