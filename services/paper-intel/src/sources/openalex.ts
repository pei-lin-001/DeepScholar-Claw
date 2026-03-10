import { nowIsoTimestamp } from "@deepscholar/contracts";
import type { FetchLike, PaperSearchQuery, RateLimiter, RawPaper } from "./types.ts";

export type OpenAlexClientOptions = {
  readonly fetch: FetchLike;
  readonly rateLimiter: RateLimiter;
  readonly politeEmail?: string;
  readonly baseUrl?: string;
};

const DEFAULT_BASE_URL = "https://api.openalex.org";

type AbstractInvertedIndex = Record<string, number[]>;

type OpenAlexWork = {
  id?: string;
  doi?: string | null;
  display_name?: string;
  publication_year?: number;
  cited_by_count?: number;
  abstract_inverted_index?: AbstractInvertedIndex | null;
  referenced_works?: string[] | null;
  authorships?: { author?: { id?: string; display_name?: string } | null }[] | null;
  primary_location?: {
    source?: { display_name?: string } | null;
    landing_page_url?: string | null;
  } | null;
  open_access?: { oa_url?: string | null } | null;
};

type SearchResponse = {
  results?: OpenAlexWork[];
};

function openAlexIdToPaperId(rawId: string): string {
  const trimmed = rawId.trim();
  const parts = trimmed.split("/");
  return parts[parts.length - 1] ?? trimmed;
}

function abstractFromInvertedIndex(index: AbstractInvertedIndex): string {
  const positions: Array<{ pos: number; token: string }> = [];
  for (const [token, posList] of Object.entries(index)) {
    for (const pos of posList) {
      positions.push({ pos, token });
    }
  }
  positions.sort((a, b) => a.pos - b.pos);
  return positions
    .map((entry) => entry.token)
    .join(" ")
    .trim();
}

function parseWork(raw: OpenAlexWork): RawPaper | null {
  const id = raw.id?.trim();
  const title = raw.display_name?.trim();
  if (!id || !title) {
    return null;
  }

  const abstract = raw.abstract_inverted_index
    ? abstractFromInvertedIndex(raw.abstract_inverted_index)
    : undefined;

  const venue = raw.primary_location?.source?.display_name?.trim() || undefined;
  const openAccessPdfUrl = raw.open_access?.oa_url?.trim() || undefined;
  const doi = raw.doi?.replace(/^https?:\/\/doi\.org\//, "").trim() || undefined;

  return {
    paperId: openAlexIdToPaperId(id),
    title,
    abstract: abstract || undefined,
    year: raw.publication_year,
    venue,
    citationCount: raw.cited_by_count,
    tldr: undefined,
    authors: (raw.authorships ?? [])
      .map((authorship) => ({
        name: authorship.author?.display_name?.trim() ?? "",
        authorId: authorship.author?.id ? openAlexIdToPaperId(authorship.author.id) : undefined,
      }))
      .filter((author) => author.name.length > 0),
    references: (raw.referenced_works ?? [])
      .map((ref) => ({
        paperId: openAlexIdToPaperId(ref),
      }))
      .filter((ref) => ref.paperId.length > 0),
    openAccessPdfUrl,
    doi,
    source: "openalex",
    fetchedAt: nowIsoTimestamp(),
  };
}

export function createOpenAlexClient(options: OpenAlexClientOptions) {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;

  async function searchPapers(query: PaperSearchQuery): Promise<RawPaper[]> {
    await options.rateLimiter.acquireSlot();

    const url = new URL(`${baseUrl}/works`);
    url.searchParams.set("search", query.query);
    url.searchParams.set("per-page", String(query.limit));
    if (options.politeEmail) {
      url.searchParams.set("mailto", options.politeEmail);
    }

    const res = await options.fetch(url.toString());
    if (!res.ok) {
      throw new Error(`OpenAlex 请求失败: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as SearchResponse;
    const rows = json.results ?? [];
    return rows.map((row) => parseWork(row)).filter((paper): paper is RawPaper => paper !== null);
  }

  return { searchPapers };
}
