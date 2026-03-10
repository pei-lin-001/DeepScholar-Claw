import { nowIsoTimestamp } from "@deepscholar/contracts";
import { describe, expect, it } from "vitest";
import { buildGraphFromPapers } from "./graph/build-graph.ts";
import { createInMemoryGraphStore } from "./graph/graph-store-memory.ts";
import type { RawPaper } from "./sources/types.ts";

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

describe("graph build", () => {
  it("writes authorships and citations into an in-memory graph", async () => {
    const graph = createInMemoryGraphStore();
    const a = paper({
      paperId: "A",
      title: "Paper A",
      authors: [{ name: "Alice" }],
      references: [{ paperId: "B" }],
    });
    const b = paper({
      paperId: "B",
      title: "Paper B",
      authors: [{ name: "Bob" }],
    });

    const summary = await buildGraphFromPapers({ papers: [a, b], graph });
    expect(summary).toEqual(
      expect.objectContaining({
        papersUpserted: 2,
        citationsLinked: 1,
        authorshipsLinked: 2,
      }),
    );

    expect(await graph.getNeighbors("A")).toEqual(
      expect.objectContaining({
        citedPaperIds: ["B"],
        authorKeys: ["Alice"],
      }),
    );
    expect(await graph.getNeighbors("B")).toEqual(
      expect.objectContaining({
        citedPaperIds: [],
        authorKeys: ["Bob"],
      }),
    );
  });
});
