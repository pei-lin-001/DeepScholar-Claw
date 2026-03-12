import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { downloadOpenAccessPdf } from "./paper-intel.ts";
import type { RawPaper } from "./sources/types.ts";
import { createFsPaperStore } from "./storage/paper-store-fs.ts";
import { resolveDeepScholarHome } from "./storage/paths.ts";

async function createTempHomeDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-paper-intel-"));
}

function pdfFixtureBytes(): Uint8Array {
  const text = [
    "%PDF-1.4",
    "% Fake PDF fixture for tests",
    "1 0 obj",
    "<< /Type /Catalog >>",
    "endobj",
    "%%EOF",
    "",
  ].join("\n");
  return new TextEncoder().encode(text);
}

function sha256Hex(bytes: Uint8Array): string {
  return crypto.createHash("sha256").update(Buffer.from(bytes)).digest("hex");
}

describe("paper-intel pdf download", () => {
  it("downloads open-access pdf for an ingested paper and writes meta json", async () => {
    const homeDir = await createTempHomeDir();
    const home = resolveDeepScholarHome(homeDir);
    const store = createFsPaperStore({ home });

    const paper: RawPaper = {
      paperId: "P1",
      title: "Demo Paper",
      authors: [],
      references: [],
      openAccessPdfUrl: "https://example.test/p1.pdf",
      source: "semantic-scholar",
      fetchedAt: "2026-03-12T00:00:00.000Z",
    };
    await store.savePaper("project-1", paper);

    const expectedBytes = pdfFixtureBytes();
    const expectedSha = sha256Hex(expectedBytes);
    const fakeFetch = async () =>
      new Response(Buffer.from(expectedBytes), {
        status: 200,
        headers: { "content-type": "application/pdf" },
      });

    const result = await downloadOpenAccessPdf({
      homeDir,
      projectId: "project-1",
      paperId: "P1",
      fetch: fakeFetch,
    });

    const downloaded = await fs.readFile(result.pdfPath);
    expect(downloaded.subarray(0, 4).toString("utf8")).toBe("%PDF");
    expect(downloaded.length).toBe(expectedBytes.length);

    const metaRaw = await fs.readFile(result.metaPath, "utf8");
    const meta = JSON.parse(metaRaw) as { sha256: string; bytes: number; httpStatus: number };
    expect(meta.httpStatus).toBe(200);
    expect(meta.bytes).toBe(expectedBytes.length);
    expect(meta.sha256).toBe(expectedSha);
  });

  it("fails with a clear error when paper is missing", async () => {
    const homeDir = await createTempHomeDir();
    await expect(
      downloadOpenAccessPdf({
        homeDir,
        projectId: "project-1",
        paperId: "missing",
        fetch: async () => new Response("nope", { status: 404 }),
      }),
    ).rejects.toThrow(/未找到 paperId=missing/);
  });

  it("rejects downloads that are not actually PDFs", async () => {
    const homeDir = await createTempHomeDir();
    const home = resolveDeepScholarHome(homeDir);
    const store = createFsPaperStore({ home });

    const paper: RawPaper = {
      paperId: "P2",
      title: "Not PDF",
      authors: [],
      references: [],
      openAccessPdfUrl: "https://example.test/p2.pdf",
      source: "openalex",
      fetchedAt: "2026-03-12T00:00:00.000Z",
    };
    await store.savePaper("project-1", paper);

    const fakeFetch = async () =>
      new Response("this is not a pdf", {
        status: 200,
        headers: { "content-type": "text/plain" },
      });

    await expect(
      downloadOpenAccessPdf({
        homeDir,
        projectId: "project-1",
        paperId: "P2",
        fetch: fakeFetch,
      }),
    ).rejects.toThrow(/不是有效 PDF/);
  });
});
