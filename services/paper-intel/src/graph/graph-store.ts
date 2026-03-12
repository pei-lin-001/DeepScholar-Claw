import type { PaperAuthor, PaperReference, RawPaper } from "../sources/types.ts";

export type GraphPaperNode = {
  readonly paperId: string;
  readonly title?: string;
  readonly year?: number;
  readonly venue?: string;
};

export type GraphAuthorNode = {
  readonly authorKey: string;
  readonly name: string;
  readonly authorId?: string;
};

export type PaperNeighbors = {
  readonly citedPaperIds: readonly string[];
  readonly authorKeys: readonly string[];
};

export type GraphStore = {
  upsertPaper(paper: GraphPaperNode): Promise<void>;
  upsertAuthor(author: GraphAuthorNode): Promise<void>;
  linkCitation(fromPaperId: string, toPaperId: string): Promise<void>;
  linkAuthorship(authorKey: string, paperId: string): Promise<void>;
  getNeighbors(paperId: string): Promise<PaperNeighbors>;
  close(): Promise<void>;
};

export function authorKeyFromAuthor(author: PaperAuthor): string {
  return author.authorId?.trim() || author.name.trim();
}

export function paperNodeFromRawPaper(paper: RawPaper): GraphPaperNode {
  return {
    paperId: paper.paperId,
    title: paper.title,
    year: paper.year,
    venue: paper.venue,
  };
}

export function authorNodeFromPaperAuthor(author: PaperAuthor): GraphAuthorNode {
  const key = authorKeyFromAuthor(author);
  return { authorKey: key, name: author.name, authorId: author.authorId };
}

export function paperNodesFromReferences(references: readonly PaperReference[]): GraphPaperNode[] {
  return references.map((ref) => ({ paperId: ref.paperId, title: ref.title }));
}
