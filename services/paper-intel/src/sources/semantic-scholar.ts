import { nowIsoTimestamp } from "@deepscholar/contracts";
import type { FetchLike, PaperSearchQuery, RateLimiter, RawPaper } from "./types.ts";

export type SemanticScholarClientOptions = {
  readonly fetch: FetchLike;
  readonly rateLimiter: RateLimiter;
  readonly apiKey?: string;
  readonly baseUrl?: string;
};

const DEFAULT_BASE_URL = "https://api.semanticscholar.org/graph/v1";

const DEFAULT_FIELDS = [
  "paperId",
  "title",
  "abstract",
  "authors",
  "year",
  "venue",
  "citationCount",
  "references",
  "tldr",
  "openAccessPdf",
  "externalIds",
] as const;

type SemanticScholarPaper = {
  paperId?: string;
  title?: string;
  abstract?: string;
  year?: number;
  venue?: string;
  citationCount?: number;
  tldr?: { text?: string } | null;
  openAccessPdf?: { url?: string } | null;
  externalIds?: { DOI?: string } | null;
  authors?: { name?: string; authorId?: string }[] | null;
  references?: { paperId?: string; title?: string }[] | null;
};

type SearchResponse = {
  data?: SemanticScholarPaper[];
};

function parsePaper(raw: SemanticScholarPaper): RawPaper | null {
  const paperId = raw.paperId?.trim();
  const title = raw.title?.trim();
  if (!paperId || !title) {
    return null;
  }
  return {
    paperId,
    title,
    abstract: raw.abstract?.trim() || undefined,
    year: raw.year,
    venue: raw.venue?.trim() || undefined,
    citationCount: raw.citationCount,
    tldr: raw.tldr?.text?.trim() || undefined,
    authors: (raw.authors ?? [])
      .map((author) => ({
        name: author.name?.trim() ?? "",
        authorId: author.authorId?.trim() || undefined,
      }))
      .filter((author) => author.name.length > 0),
    references: (raw.references ?? [])
      .map((ref) => ({
        paperId: ref.paperId?.trim() ?? "",
        title: ref.title?.trim() || undefined,
      }))
      .filter((ref) => ref.paperId.length > 0),
    openAccessPdfUrl: raw.openAccessPdf?.url?.trim() || undefined,
    doi: raw.externalIds?.DOI?.trim() || undefined,
    source: "semantic-scholar",
    fetchedAt: nowIsoTimestamp(),
  };
}

export function createSemanticScholarClient(options: SemanticScholarClientOptions) {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

  async function searchPapers(query: PaperSearchQuery): Promise<RawPaper[]> {
    await options.rateLimiter.acquireSlot();

    const url = new URL(`${baseUrl}/paper/search`);
    url.searchParams.set("query", query.query);
    url.searchParams.set("limit", String(query.limit));
    url.searchParams.set("fields", DEFAULT_FIELDS.join(","));

    const headers: Record<string, string> = {};
    if (options.apiKey) {
      headers["x-api-key"] = options.apiKey;
    }

    const res = await options.fetch(url.toString(), { headers });
    if (!res.ok) {
      throw new Error(`Semantic Scholar 请求失败: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as SearchResponse;
    const rows = json.data ?? [];
    const parsed = rows
      .map((row) => parsePaper(row))
      .filter((paper): paper is RawPaper => paper !== null);
    return parsed;
  }

  return { searchPapers };
}
