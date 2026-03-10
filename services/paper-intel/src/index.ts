import { pathToFileURL } from "node:url";
import type { ServiceDescriptor } from "@deepscholar/contracts";

export {
  buildProjectGraphInNeo4j,
  ingestFromSearch,
  parsePdfWithGrobid,
  queryProjectLiterature,
  searchPapers,
  type PaperIntelGraphBuildOptions,
  type PaperIntelGrobidParseOptions,
  type PaperIntelHomeOptions,
  type PaperIntelIngestOptions,
  type PaperIntelQueryOptions,
  type PaperIntelSearchOptions,
  type SearchSource,
} from "./paper-intel.ts";

export const paperIntelService: ServiceDescriptor = {
  id: "paper-intel",
  displayName: "Paper Intelligence",
  owns: ["paper ingest", "metadata merge", "graph build", "citation evidence"],
  consumes: ["project topic", "research queries"],
  produces: ["proposal evidence", "claim snippets", "literature maps"],
  outOfScope: ["project approvals", "gpu orchestration", "paper drafting"],
};

export const literaturePipelineStages = [
  "collect",
  "deduplicate",
  "parse",
  "index",
  "extract-evidence",
] as const;

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  console.log(
    JSON.stringify({ service: paperIntelService, pipeline: literaturePipelineStages }, null, 2),
  );
}
