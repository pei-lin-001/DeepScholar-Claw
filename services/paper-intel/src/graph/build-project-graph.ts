import type { PaperStore } from "../storage/paper-store.ts";
import { buildGraphFromPapers, type GraphBuildSummary } from "./build-graph.ts";
import type { GraphStore } from "./graph-store.ts";

export async function buildProjectGraph(options: {
  readonly projectId: string;
  readonly store: PaperStore;
  readonly graph: GraphStore;
}): Promise<GraphBuildSummary> {
  const papers = await options.store.loadPapers(options.projectId);
  return await buildGraphFromPapers({ papers, graph: options.graph });
}
