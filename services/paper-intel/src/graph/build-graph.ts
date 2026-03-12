import type { RawPaper } from "../sources/types.ts";
import {
  authorKeyFromAuthor,
  authorNodeFromPaperAuthor,
  paperNodeFromRawPaper,
  paperNodesFromReferences,
  type GraphStore,
} from "./graph-store.ts";

export type GraphBuildSummary = {
  readonly papersUpserted: number;
  readonly authorsUpserted: number;
  readonly citationsLinked: number;
  readonly authorshipsLinked: number;
  readonly referenceNodesUpserted: number;
};

export async function buildGraphFromPapers(options: {
  readonly papers: readonly RawPaper[];
  readonly graph: GraphStore;
}): Promise<GraphBuildSummary> {
  const seenPaperIds = new Set<string>();
  const seenAuthorKeys = new Set<string>();
  let sourcePaperUpserts = 0;
  let citationsLinked = 0;
  let authorshipsLinked = 0;
  let referenceNodesUpserted = 0;

  for (const paper of options.papers) {
    await options.graph.upsertPaper(paperNodeFromRawPaper(paper));
    sourcePaperUpserts += 1;
    seenPaperIds.add(paper.paperId);

    for (const author of paper.authors) {
      const key = authorKeyFromAuthor(author);
      if (!seenAuthorKeys.has(key)) {
        await options.graph.upsertAuthor(authorNodeFromPaperAuthor(author));
        seenAuthorKeys.add(key);
      }
      await options.graph.linkAuthorship(key, paper.paperId);
      authorshipsLinked += 1;
    }

    const referenceNodes = paperNodesFromReferences(paper.references);
    for (const refNode of referenceNodes) {
      if (!seenPaperIds.has(refNode.paperId)) {
        await options.graph.upsertPaper(refNode);
        seenPaperIds.add(refNode.paperId);
        referenceNodesUpserted += 1;
      }
      await options.graph.linkCitation(paper.paperId, refNode.paperId);
      citationsLinked += 1;
    }
  }

  return {
    papersUpserted: sourcePaperUpserts,
    authorsUpserted: seenAuthorKeys.size,
    citationsLinked,
    authorshipsLinked,
    referenceNodesUpserted,
  };
}
