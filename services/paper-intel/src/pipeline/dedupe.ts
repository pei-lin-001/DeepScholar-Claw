import type { RawPaper } from "../sources/types.ts";

export type DedupedPapers = {
  readonly uniquePapers: RawPaper[];
  readonly duplicateCount: number;
};

function dedupeKey(paper: RawPaper): string {
  if (paper.doi) {
    return `doi:${paper.doi.trim().toLowerCase()}`;
  }
  const year = paper.year ?? 0;
  const title = paper.title.trim().toLowerCase().replaceAll(/\s+/g, " ");
  return `title:${year}:${title}`;
}

export function dedupePapers(papers: readonly RawPaper[]): DedupedPapers {
  const seen = new Set<string>();
  const unique: RawPaper[] = [];
  let duplicates = 0;

  for (const paper of papers) {
    const key = dedupeKey(paper);
    if (seen.has(key)) {
      duplicates += 1;
      continue;
    }
    seen.add(key);
    unique.push(paper);
  }

  return { uniquePapers: unique, duplicateCount: duplicates };
}
