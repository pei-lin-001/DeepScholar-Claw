import fs from "node:fs/promises";
import type { Command } from "commander";
import {
  buildProjectGraphInNeo4j,
  ingestFromSearch,
  parsePdfWithGrobid,
  queryProjectLiterature,
  searchPapers,
  type SearchSource,
} from "../../services/paper-intel/src/index.js";
import { defaultRuntime } from "../runtime.js";
import { runCommandWithRuntime } from "./cli-utils.js";
import { registerResearchOrchestratorCli } from "./research-orchestrator-cli.js";

const DEFAULT_LIMIT = 5;
const DEFAULT_MIN_YEAR = 2018;
const DEFAULT_GROBID_URL = "http://127.0.0.1:8070";

function parseString(raw: unknown, label: string, fallback?: string): string {
  if (raw === undefined || raw === null || raw === "") {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`${label} 不能为空`);
  }
  if (typeof raw === "string") {
    return raw;
  }
  if (typeof raw === "number") {
    return String(raw);
  }
  throw new Error(`${label} 必须是字符串`);
}

function parsePositiveInt(raw: unknown, label: string, fallback: number): number {
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }
  let n: number;
  if (typeof raw === "number") {
    n = raw;
  } else if (typeof raw === "string") {
    n = Number(raw);
  } else {
    throw new Error(`${label} 必须是数字或数字字符串`);
  }
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${label} 必须是正整数`);
  }
  return n;
}

function parseSource(raw: unknown): SearchSource {
  const value = parseString(raw, "source", "semantic-scholar");
  if (value === "semantic-scholar" || value === "openalex") {
    return value;
  }
  throw new Error("source 必须是 semantic-scholar 或 openalex");
}

function resolveNeo4jConfig(opts: { uri?: string; username?: string; password?: string }) {
  const uri = opts.uri ?? process.env.DEEPSCHOLAR_NEO4J_URI;
  const username = opts.username ?? process.env.DEEPSCHOLAR_NEO4J_USERNAME;
  const password = opts.password ?? process.env.DEEPSCHOLAR_NEO4J_PASSWORD;
  if (!uri || !username || !password) {
    throw new Error("Neo4j 连接信息缺失：需要 DEEPSCHOLAR_NEO4J_URI/USERNAME/PASSWORD 或 CLI 选项");
  }
  return { uri, username, password };
}

export function registerResearchCli(program: Command) {
  const research = program.command("research").description("DeepScholar research tools");
  registerLiteratureCli(research);
  registerResearchOrchestratorCli(research);
}

function registerLiteratureCli(research: Command) {
  const literature = research
    .command("literature")
    .description("Literature ingest, parse, graph, and query");
  registerLiteratureSearch(literature);
  registerLiteratureIngest(literature);
  registerLiteratureGrobid(literature);
  registerLiteratureGraphBuild(literature);
  registerLiteratureQuery(literature);
}

function registerLiteratureSearch(literature: Command) {
  literature
    .command("search")
    .description("Search papers via Semantic Scholar or OpenAlex")
    .requiredOption("--query <text>", "Search query")
    .option("--source <source>", "semantic-scholar | openalex", "semantic-scholar")
    .option("--limit <n>", "Max results", String(DEFAULT_LIMIT))
    .option("--openalex-mailto <email>", "OpenAlex polite pool mailto")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, () => runLiteratureSearch(opts));
    });
}

async function runLiteratureSearch(opts: Record<string, unknown>) {
  const source = parseSource(opts.source);
  const limit = parsePositiveInt(opts.limit, "limit", DEFAULT_LIMIT);
  const semanticScholarApiKey = process.env.DEEPSCHOLAR_SEMANTIC_SCHOLAR_API_KEY;
  const openAlexPoliteEmail =
    (opts.openalexMailto as string | undefined) ?? process.env.DEEPSCHOLAR_OPENALEX_MAILTO;
  const papers = await searchPapers({
    source,
    query: parseString(opts.query, "query"),
    limit,
    semanticScholarApiKey,
    openAlexPoliteEmail,
  });
  if (opts.json) {
    defaultRuntime.log(JSON.stringify(papers, null, 2));
    return;
  }
  for (const paper of papers) {
    const year = paper.year ? String(paper.year) : "????";
    defaultRuntime.log(`${paper.paperId} | ${year} | ${paper.title}`);
  }
}

function registerLiteratureIngest(literature: Command) {
  literature
    .command("ingest")
    .description("Search and save papers into ~/.deepscholar/projects/<id>/literature/papers")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--query <text>", "Search query")
    .option("--source <source>", "semantic-scholar | openalex", "semantic-scholar")
    .option("--limit <n>", "Max results", String(DEFAULT_LIMIT))
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--min-year <year>", "Drop papers older than this year", String(DEFAULT_MIN_YEAR))
    .option("--require-open-access-pdf", "Drop papers without open access PDF url", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, () => runLiteratureIngest(opts));
    });
}

async function runLiteratureIngest(opts: Record<string, unknown>) {
  const source = parseSource(opts.source);
  const limit = parsePositiveInt(opts.limit, "limit", DEFAULT_LIMIT);
  const minYear = parsePositiveInt(opts.minYear, "min-year", DEFAULT_MIN_YEAR);
  const semanticScholarApiKey = process.env.DEEPSCHOLAR_SEMANTIC_SCHOLAR_API_KEY;
  const openAlexPoliteEmail = process.env.DEEPSCHOLAR_OPENALEX_MAILTO;
  const result = await ingestFromSearch({
    projectId: parseString(opts.projectId, "project-id"),
    homeDir: opts.home as string | undefined,
    source,
    query: parseString(opts.query, "query"),
    limit,
    semanticScholarApiKey,
    openAlexPoliteEmail,
    qualityPolicy: {
      minYear,
      requireAbstractOrTldr: true,
      requireOpenAccessPdf: Boolean(opts.requireOpenAccessPdf),
    },
  });
  defaultRuntime.log(JSON.stringify(result.summary, null, 2));
}

function registerLiteratureGrobid(literature: Command) {
  literature
    .command("grobid")
    .description("Parse a PDF with GROBID and store TEI xml")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--paper-id <id>", "Paper id")
    .requiredOption("--pdf <path>", "Path to PDF")
    .option("--grobid-url <url>", "GROBID base URL", DEFAULT_GROBID_URL)
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, () => runLiteratureGrobid(opts));
    });
}

async function runLiteratureGrobid(opts: Record<string, unknown>) {
  const pdfBytes = await fs.readFile(parseString(opts.pdf, "pdf"));
  const tei = await parsePdfWithGrobid({
    projectId: parseString(opts.projectId, "project-id"),
    paperId: parseString(opts.paperId, "paper-id"),
    homeDir: opts.home as string | undefined,
    pdfBytes,
    grobidBaseUrl: parseString(opts.grobidUrl, "grobid-url", DEFAULT_GROBID_URL),
  });
  defaultRuntime.log(tei.slice(0, 200));
}

function registerLiteratureGraphBuild(literature: Command) {
  literature
    .command("graph-build")
    .description("Build a Neo4j knowledge graph from stored papers")
    .requiredOption("--project-id <id>", "Project id")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--neo4j-uri <uri>", "Neo4j URI (or DEEPSCHOLAR_NEO4J_URI)")
    .option("--neo4j-username <name>", "Neo4j username (or DEEPSCHOLAR_NEO4J_USERNAME)")
    .option("--neo4j-password <password>", "Neo4j password (or DEEPSCHOLAR_NEO4J_PASSWORD)")
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, () => runLiteratureGraphBuild(opts));
    });
}

async function runLiteratureGraphBuild(opts: Record<string, unknown>) {
  const neo4j = resolveNeo4jConfig({
    uri: opts.neo4jUri as string | undefined,
    username: opts.neo4jUsername as string | undefined,
    password: opts.neo4jPassword as string | undefined,
  });
  const summary = await buildProjectGraphInNeo4j({
    projectId: parseString(opts.projectId, "project-id"),
    homeDir: opts.home as string | undefined,
    neo4j,
  });
  defaultRuntime.log(JSON.stringify(summary, null, 2));
}

function registerLiteratureQuery(literature: Command) {
  literature
    .command("query")
    .description("Query local index and expand via graph neighbors")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--query <text>", "Query text")
    .option("--limit <n>", "Max hits", String(DEFAULT_LIMIT))
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--graph-backend <backend>", "memory | neo4j", "memory")
    .option("--neo4j-uri <uri>", "Neo4j URI (or DEEPSCHOLAR_NEO4J_URI)")
    .option("--neo4j-username <name>", "Neo4j username (or DEEPSCHOLAR_NEO4J_USERNAME)")
    .option("--neo4j-password <password>", "Neo4j password (or DEEPSCHOLAR_NEO4J_PASSWORD)")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(defaultRuntime, () => runLiteratureQuery(opts));
    });
}

async function runLiteratureQuery(opts: Record<string, unknown>) {
  const limit = parsePositiveInt(opts.limit, "limit", DEFAULT_LIMIT);
  const backend = parseString(opts.graphBackend, "graph-backend", "memory");
  const graphBackend = backend === "neo4j" ? "neo4j" : "memory";
  const neo4j =
    graphBackend === "neo4j"
      ? resolveNeo4jConfig({
          uri: opts.neo4jUri as string | undefined,
          username: opts.neo4jUsername as string | undefined,
          password: opts.neo4jPassword as string | undefined,
        })
      : undefined;

  const result = await queryProjectLiterature({
    projectId: parseString(opts.projectId, "project-id"),
    homeDir: opts.home as string | undefined,
    queryText: parseString(opts.query, "query"),
    limit,
    graphBackend,
    neo4j,
  });

  if (opts.json) {
    defaultRuntime.log(JSON.stringify(result, null, 2));
    return;
  }

  for (const hit of result.hits) {
    defaultRuntime.log(`${hit.paperId} | score=${hit.score} | ${hit.title}`);
    defaultRuntime.log(`  cited: ${hit.neighbors.citedPaperIds.join(", ") || "(none)"}`);
    defaultRuntime.log(`  authors: ${hit.neighbors.authorKeys.join(", ") || "(none)"}`);
  }
}
