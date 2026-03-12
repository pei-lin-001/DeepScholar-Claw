import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createPaperDraft } from "@deepscholar/contracts";
import { describe, expect, it } from "vitest";
import { writePaperBundle } from "./paper-bundle-fs.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-writing-"));
}

async function seedLiteraturePaper(
  homeDir: string,
  projectId: string,
  paperId: string,
): Promise<void> {
  const papersDir = path.join(homeDir, "projects", projectId, "literature", "papers");
  await fs.mkdir(papersDir, { recursive: true });
  await fs.writeFile(
    path.join(papersDir, `${paperId}.json`),
    JSON.stringify({ paperId }, null, 2),
    "utf8",
  );
}

describe("writing paper bundle", () => {
  it("writes main.tex + refs.bib and surfaces missing citations", async () => {
    const homeDir = await createTempDir();
    await seedLiteraturePaper(homeDir, "p1", "known-1");

    const draft = createPaperDraft({
      draftId: "d1",
      projectId: "p1",
      planId: "plan-1",
      title: "Demo Paper",
      venue: "arxiv",
      status: "draft",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:01.000Z",
      citations: ["known-1", "missing-1"],
    });

    const result = await writePaperBundle({ homeDir, draft, bibYear: "2026" });
    expect(result.bundle.paths.mainTexPath).toContain(path.join("paper", "drafts", "d1"));
    expect(result.bundle.extractedCitationKeys).toEqual(["known-1", "missing-1"]);
    expect(result.citationCheck.allCitationsValid).toBe(false);
    expect(result.citationCheck.missing).toEqual(["missing-1"]);

    const tex = await fs.readFile(result.bundle.paths.mainTexPath, "utf8");
    expect(tex).toContain("\\bibliography{refs}");
    expect(tex).toContain("\\cite{known-1,missing-1}");

    const bib = await fs.readFile(result.bundle.paths.refsBibPath, "utf8");
    expect(bib).toContain("@misc{known-1");
    expect(bib).toContain("@misc{missing-1");
  });

  it("passes citation check when all citations exist", async () => {
    const homeDir = await createTempDir();
    await seedLiteraturePaper(homeDir, "p1", "k1");
    await seedLiteraturePaper(homeDir, "p1", "k2");

    const draft = createPaperDraft({
      draftId: "d2",
      projectId: "p1",
      planId: "plan-1",
      title: "Demo Paper",
      venue: "arxiv",
      status: "draft",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:01.000Z",
      citations: ["k1", "k2"],
    });

    const result = await writePaperBundle({ homeDir, draft, bibYear: "2026" });
    expect(result.citationCheck).toEqual({ allCitationsValid: true, missing: [] });
  });
});
