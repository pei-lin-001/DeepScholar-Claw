import type { GraphAuthorNode, GraphPaperNode, GraphStore, PaperNeighbors } from "./graph-store.ts";

export function createInMemoryGraphStore(): GraphStore {
  const papers = new Map<string, GraphPaperNode>();
  const authors = new Map<string, GraphAuthorNode>();
  const citations = new Map<string, Set<string>>();
  const authorships = new Map<string, Set<string>>();

  async function upsertPaper(paper: GraphPaperNode): Promise<void> {
    papers.set(paper.paperId, { ...papers.get(paper.paperId), ...paper });
  }

  async function upsertAuthor(author: GraphAuthorNode): Promise<void> {
    authors.set(author.authorKey, { ...authors.get(author.authorKey), ...author });
  }

  async function linkCitation(fromPaperId: string, toPaperId: string): Promise<void> {
    const set = citations.get(fromPaperId) ?? new Set<string>();
    set.add(toPaperId);
    citations.set(fromPaperId, set);
  }

  async function linkAuthorship(authorKey: string, paperId: string): Promise<void> {
    const set = authorships.get(authorKey) ?? new Set<string>();
    set.add(paperId);
    authorships.set(authorKey, set);
  }

  async function getNeighbors(paperId: string): Promise<PaperNeighbors> {
    const cited = [...(citations.get(paperId) ?? new Set<string>())];
    const authorKeys = [...authorships.entries()]
      .filter(([_key, paperIds]) => paperIds.has(paperId))
      .map(([key]) => key);
    return { citedPaperIds: cited, authorKeys };
  }

  async function close(): Promise<void> {
    // no-op
  }

  return {
    upsertPaper,
    upsertAuthor,
    linkCitation,
    linkAuthorship,
    getNeighbors,
    close,
  };
}
