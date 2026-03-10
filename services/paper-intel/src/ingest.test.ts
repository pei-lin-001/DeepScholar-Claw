import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { nowIsoTimestamp } from "@deepscholar/contracts";
import { describe, expect, it } from "vitest";
import { ingestPapers } from "./pipeline/ingest.ts";
import { createDefaultQualityPolicy } from "./pipeline/quality-filter.ts";
import type { RawPaper } from "./sources/types.ts";
import { createFsPaperStore } from "./storage/paper-store-fs.ts";
import { resolveDeepScholarHome } from "./storage/paths.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-paper-intel-"));
}

function paper(partial: Partial<RawPaper> & Pick<RawPaper, "paperId" | "title">): RawPaper {
  return {
    paperId: partial.paperId,
    title: partial.title,
    abstract: partial.abstract,
    year: partial.year,
    venue: partial.venue,
    citationCount: partial.citationCount,
    tldr: partial.tldr,
    authors: partial.authors ?? [],
    references: partial.references ?? [],
    openAccessPdfUrl: partial.openAccessPdfUrl,
    doi: partial.doi,
    source: partial.source ?? "fixture",
    fetchedAt: partial.fetchedAt ?? nowIsoTimestamp(),
  };
}

describe("literature ingest pipeline", () => {
  it("dedupes, filters, and saves kept papers into ~/.deepscholar-like layout", async () => {
    const tmp = await createTempDir();
    const store = createFsPaperStore({ home: resolveDeepScholarHome(tmp) });
    const policy = createDefaultQualityPolicy();

    const p1 = paper({
      paperId: "p1",
      title: "Good Paper",
      abstract: "Has abstract",
      year: 2024,
      doi: "10.1/abc",
    });
    const p1dup = paper({
      paperId: "p1-dup",
      title: "Good Paper (duplicate id, same doi)",
      abstract: "Has abstract",
      year: 2024,
      doi: "10.1/abc",
    });
    const missingAbstract = paper({
      paperId: "p2",
      title: "No abstract",
      year: 2024,
    });
    const tooOld = paper({
      paperId: "p3",
      title: "Old",
      abstract: "ok",
      year: 2000,
    });

    const result = await ingestPapers({
      projectId: "proj-1",
      papers: [p1, p1dup, missingAbstract, tooOld],
      policy,
      store,
    });

    expect(result.summary.fetched).toBe(4);
    expect(result.summary.duplicates).toBe(1);
    expect(result.summary.kept).toBe(1);
    expect(result.summary.dropped).toBe(2);
    expect(result.summary.droppedByReason).toEqual(
      expect.objectContaining({
        "missing-abstract": 1,
        "too-old": 1,
      }),
    );

    const saved = await store.loadPapers("proj-1");
    expect(saved).toHaveLength(1);
    expect(saved[0]?.paperId).toBe("p1");
    expect(saved[0]?.doi).toBe("10.1/abc");
  });
});
