import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { nowIsoTimestamp } from "@deepscholar/contracts";
import { describe, expect, it } from "vitest";
import { buildGraphFromPapers } from "./graph/build-graph.ts";
import { createInMemoryGraphStore } from "./graph/graph-store-memory.ts";
import { queryGraphRag } from "./retrieval/graph-rag.ts";
import type { RawPaper } from "./sources/types.ts";
import { createFsPaperStore } from "./storage/paper-store-fs.ts";
import { resolveDeepScholarHome } from "./storage/paths.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-query-"));
}

function paper(p: Partial<RawPaper> & Pick<RawPaper, "paperId" | "title">): RawPaper {
  return {
    paperId: p.paperId,
    title: p.title,
    abstract: p.abstract,
    year: p.year,
    venue: p.venue,
    citationCount: p.citationCount,
    tldr: p.tldr,
    authors: p.authors ?? [],
    references: p.references ?? [],
    openAccessPdfUrl: p.openAccessPdfUrl,
    doi: p.doi,
    source: p.source ?? "fixture",
    fetchedAt: p.fetchedAt ?? nowIsoTimestamp(),
  };
}

describe("graph rag query", () => {
  it("returns global hits and local graph neighbors", async () => {
    const tmp = await createTempDir();
    const home = resolveDeepScholarHome(tmp);
    const store = createFsPaperStore({ home });

    const a = paper({
      paperId: "A",
      title: "Graph RAG for Literature Review",
      abstract: "We retrieve and expand via citations.",
      year: 2025,
      authors: [{ name: "Alice" }],
      references: [{ paperId: "B", title: "Baseline RAG" }],
    });
    const b = paper({
      paperId: "B",
      title: "Baseline RAG",
      abstract: "Plain retrieval.",
      year: 2024,
      authors: [{ name: "Bob" }],
    });

    await store.savePaper("proj-1", a);
    await store.savePaper("proj-1", b);

    const graph = createInMemoryGraphStore();
    await buildGraphFromPapers({ papers: [a, b], graph });

    const result = await queryGraphRag({
      projectId: "proj-1",
      queryText: "graph",
      limit: 5,
      store,
      graph,
    });

    expect(result.totalIndexedPapers).toBe(2);
    expect(result.hits[0]).toEqual(
      expect.objectContaining({
        paperId: "A",
        title: "Graph RAG for Literature Review",
        neighbors: expect.objectContaining({ citedPaperIds: ["B"], authorKeys: ["Alice"] }),
      }),
    );
  });
});
