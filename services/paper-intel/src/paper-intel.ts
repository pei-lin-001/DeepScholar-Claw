import path from "node:path";
import { buildGraphFromPapers } from "./graph/build-graph.ts";
import type { GraphBuildSummary } from "./graph/build-graph.ts";
import { buildProjectGraph } from "./graph/build-project-graph.ts";
import { createInMemoryGraphStore } from "./graph/graph-store-memory.ts";
import { createNeo4jGraphStore } from "./graph/graph-store-neo4j.ts";
import {
  downloadOpenAccessPdfToFile,
  type PdfDownloadResult,
} from "./pdf/download-open-access-pdf.ts";
import { createGrobidClient } from "./grobid/grobid-client.ts";
import { parseAndStoreTei } from "./grobid/parse-and-store.ts";
import { ingestPapers, type IngestResult } from "./pipeline/ingest.ts";
import { createDefaultQualityPolicy, type PaperQualityPolicy } from "./pipeline/quality-filter.ts";
import { queryGraphRag, type GraphRagQueryResult } from "./retrieval/graph-rag.ts";
import { createOpenAlexClient } from "./sources/openalex.ts";
import { createRateLimiter } from "./sources/rate-limiter.ts";
import { createSemanticScholarClient } from "./sources/semantic-scholar.ts";
import type { FetchLike, PaperSearchQuery, PaperSourceId, RawPaper } from "./sources/types.ts";
import { createFsPaperStore } from "./storage/paper-store-fs.ts";
import { resolveDeepScholarHome } from "./storage/paths.ts";
import { resolveProjectPaths } from "./storage/paths.ts";
import { safeIdForFileName } from "./storage/safe-filename.ts";
import { createFsTeiStore } from "./storage/tei-store-fs.ts";

export type SearchSource = Exclude<PaperSourceId, "fixture">;

export type PaperIntelSearchOptions = {
  readonly source: SearchSource;
  readonly query: string;
  readonly limit: number;
  readonly semanticScholarApiKey?: string;
  readonly openAlexPoliteEmail?: string;
};

export type PaperIntelHomeOptions = {
  readonly homeDir?: string;
};

export type PaperIntelIngestOptions = PaperIntelSearchOptions &
  PaperIntelHomeOptions & {
    readonly projectId: string;
    readonly qualityPolicy?: PaperQualityPolicy;
  };

export type PaperIntelQueryOptions = PaperIntelHomeOptions & {
  readonly projectId: string;
  readonly queryText: string;
  readonly limit: number;
  readonly graphBackend?: "memory" | "neo4j";
  readonly neo4j?: { uri: string; username: string; password: string };
};

export type PaperIntelGraphBuildOptions = PaperIntelHomeOptions & {
  readonly projectId: string;
  readonly neo4j: { uri: string; username: string; password: string };
};

export type PaperIntelGrobidParseOptions = PaperIntelHomeOptions & {
  readonly projectId: string;
  readonly paperId: string;
  readonly pdfBytes: Uint8Array;
  readonly grobidBaseUrl: string;
};

export type PaperIntelPdfDownloadOptions = PaperIntelHomeOptions & {
  readonly projectId: string;
  readonly paperId: string;
  readonly fetch?: FetchLike;
};

const DEFAULT_SEARCH_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_SEMANTIC_SCHOLAR_RPS = 100;
const DEFAULT_OPENALEX_RPS = 50;
const DEFAULT_GROBID_REQUESTS_PER_MINUTE = 10;
const DEFAULT_ONE_MINUTE_MS = 60_000;

function createLimiterForSource(source: SearchSource) {
  if (source === "semantic-scholar") {
    return createRateLimiter({
      requests: DEFAULT_SEMANTIC_SCHOLAR_RPS,
      windowMs: DEFAULT_SEARCH_WINDOW_MS,
    });
  }
  return createRateLimiter({ requests: DEFAULT_OPENALEX_RPS, windowMs: DEFAULT_SEARCH_WINDOW_MS });
}

export async function searchPapers(options: PaperIntelSearchOptions): Promise<RawPaper[]> {
  const query: PaperSearchQuery = { query: options.query, limit: options.limit };
  const rateLimiter = createLimiterForSource(options.source);

  if (options.source === "semantic-scholar") {
    const client = createSemanticScholarClient({
      fetch,
      rateLimiter,
      apiKey: options.semanticScholarApiKey,
    });
    return await client.searchPapers(query);
  }

  const client = createOpenAlexClient({
    fetch,
    rateLimiter,
    politeEmail: options.openAlexPoliteEmail,
  });
  return await client.searchPapers(query);
}

export async function ingestFromSearch(options: PaperIntelIngestOptions): Promise<IngestResult> {
  const papers = await searchPapers(options);
  const home = resolveDeepScholarHome(options.homeDir);
  const store = createFsPaperStore({ home });
  const policy = options.qualityPolicy ?? createDefaultQualityPolicy();
  return await ingestPapers({
    projectId: options.projectId,
    papers,
    policy,
    store,
  });
}

export async function downloadOpenAccessPdf(
  options: PaperIntelPdfDownloadOptions,
): Promise<PdfDownloadResult> {
  const home = resolveDeepScholarHome(options.homeDir);
  const store = createFsPaperStore({ home });
  const papers = await store.loadPapers(options.projectId);
  const paper = papers.find((item) => item.paperId === options.paperId);
  if (!paper) {
    throw new Error(`未找到 paperId=${options.paperId}，请先 ingest`);
  }
  if (!paper.openAccessPdfUrl) {
    throw new Error(`该论文缺少 openAccessPdfUrl，无法自动下载: paperId=${paper.paperId}`);
  }

  const paths = resolveProjectPaths(home, options.projectId);
  const safePaperId = safeIdForFileName(paper.paperId, "paperId");
  const pdfPath = path.join(paths.pdfsDir, `${safePaperId}.pdf`);
  const metaPath = path.join(paths.pdfsDir, `${safePaperId}.pdf.json`);

  return await downloadOpenAccessPdfToFile({
    fetch: options.fetch ?? fetch,
    url: paper.openAccessPdfUrl,
    pdfPath,
    metaPath,
  });
}

async function resolveGraphBackend(options: PaperIntelQueryOptions) {
  if (options.graphBackend === "neo4j") {
    const neo4j = options.neo4j;
    if (!neo4j) {
      throw new Error("graphBackend=neo4j 需要提供 neo4j 连接信息");
    }
    return createNeo4jGraphStore(neo4j);
  }
  return createInMemoryGraphStore();
}

export async function queryProjectLiterature(
  options: PaperIntelQueryOptions,
): Promise<GraphRagQueryResult> {
  const home = resolveDeepScholarHome(options.homeDir);
  const store = createFsPaperStore({ home });
  const graph = await resolveGraphBackend(options);
  try {
    if (options.graphBackend === "neo4j") {
      await buildProjectGraph({ projectId: options.projectId, store, graph });
    } else {
      const papers = await store.loadPapers(options.projectId);
      await buildGraphFromPapers({ papers, graph });
    }
    return await queryGraphRag({
      projectId: options.projectId,
      queryText: options.queryText,
      limit: options.limit,
      store,
      graph,
    });
  } finally {
    await graph.close();
  }
}

export async function buildProjectGraphInNeo4j(
  options: PaperIntelGraphBuildOptions,
): Promise<GraphBuildSummary> {
  const home = resolveDeepScholarHome(options.homeDir);
  const store = createFsPaperStore({ home });
  const graph = createNeo4jGraphStore(options.neo4j);
  try {
    return await buildProjectGraph({ projectId: options.projectId, store, graph });
  } finally {
    await graph.close();
  }
}

export async function parsePdfWithGrobid(options: PaperIntelGrobidParseOptions): Promise<string> {
  const home = resolveDeepScholarHome(options.homeDir);
  const teiStore = createFsTeiStore({ home });
  const grobid = createGrobidClient({
    fetch,
    rateLimiter: createRateLimiter({
      requests: DEFAULT_GROBID_REQUESTS_PER_MINUTE,
      windowMs: DEFAULT_ONE_MINUTE_MS,
    }),
    baseUrl: options.grobidBaseUrl,
  });
  return await parseAndStoreTei({
    projectId: options.projectId,
    paperId: options.paperId,
    pdfBytes: options.pdfBytes,
    grobid,
    teiStore,
  });
}
