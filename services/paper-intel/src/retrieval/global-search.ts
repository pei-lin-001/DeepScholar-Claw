import type { RawPaper } from "../sources/types.ts";
import { tokenize } from "./tokenize.ts";

export type ScoredPaperHit = {
  readonly paperId: string;
  readonly title: string;
  readonly score: number;
  readonly matchedTokens: readonly string[];
};

const TITLE_MATCH_WEIGHT = 3;
const ABSTRACT_MATCH_WEIGHT = 1;
const TLDR_MATCH_WEIGHT = 1;

function scorePaper(paper: RawPaper, queryTokens: readonly string[]): ScoredPaperHit | null {
  const titleTokens = new Set(tokenize(paper.title));
  const abstractTokens = new Set(tokenize(paper.abstract ?? ""));
  const tldrTokens = new Set(tokenize(paper.tldr ?? ""));

  let score = 0;
  const matched: string[] = [];
  for (const token of queryTokens) {
    if (titleTokens.has(token)) {
      score += TITLE_MATCH_WEIGHT;
      matched.push(token);
      continue;
    }
    if (abstractTokens.has(token)) {
      score += ABSTRACT_MATCH_WEIGHT;
      matched.push(token);
      continue;
    }
    if (tldrTokens.has(token)) {
      score += TLDR_MATCH_WEIGHT;
      matched.push(token);
    }
  }

  if (score <= 0) {
    return null;
  }

  return {
    paperId: paper.paperId,
    title: paper.title,
    score,
    matchedTokens: [...new Set(matched)],
  };
}

export function searchPapersGlobal(
  papers: readonly RawPaper[],
  queryText: string,
  limit: number,
): ScoredPaperHit[] {
  const queryTokens = tokenize(queryText);
  const hits = papers
    .map((paper) => scorePaper(paper, queryTokens))
    .filter((hit): hit is ScoredPaperHit => hit !== null)
    .toSorted((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}
