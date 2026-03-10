import type { GraphStore, PaperNeighbors } from "../graph/graph-store.ts";
import type { PaperStore } from "../storage/paper-store.ts";
import { searchPapersGlobal, type ScoredPaperHit } from "./global-search.ts";

export type GraphRagHit = ScoredPaperHit & {
  readonly neighbors: PaperNeighbors;
};

export type GraphRagQueryResult = {
  readonly totalIndexedPapers: number;
  readonly hits: readonly GraphRagHit[];
};

export async function queryGraphRag(options: {
  readonly projectId: string;
  readonly queryText: string;
  readonly limit: number;
  readonly store: PaperStore;
  readonly graph: GraphStore;
}): Promise<GraphRagQueryResult> {
  const papers = await options.store.loadPapers(options.projectId);
  const hits = searchPapersGlobal(papers, options.queryText, options.limit);
  const enriched = await Promise.all(
    hits.map(async (hit) => ({
      ...hit,
      neighbors: await options.graph.getNeighbors(hit.paperId),
    })),
  );
  return { totalIndexedPapers: papers.length, hits: enriched };
}
