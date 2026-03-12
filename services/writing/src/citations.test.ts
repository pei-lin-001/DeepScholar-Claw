import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractCitationKeysFromTex, loadKnownPaperIds, verifyCitationKeys } from "./citations.ts";
import type { WritingProjectPaths } from "./writing-paths.ts";

describe("extractCitationKeysFromTex", () => {
  it("extracts \\cite{key}", () => {
    const result = extractCitationKeysFromTex("See \\cite{smith2024} for details.");
    expect(result.keys).toEqual(["smith2024"]);
  });

  it("extracts \\citet and \\citep variants", () => {
    const tex = "\\citet{alpha} and \\citep{beta} and \\citeauthor{gamma}";
    const result = extractCitationKeysFromTex(tex);
    expect(result.keys).toContain("alpha");
    expect(result.keys).toContain("beta");
    expect(result.keys).toContain("gamma");
  });

  it("splits comma-separated keys", () => {
    const result = extractCitationKeysFromTex("\\cite{a,b,c}");
    expect(result.keys).toEqual(["a", "b", "c"]);
  });

  it("deduplicates keys", () => {
    const result = extractCitationKeysFromTex("\\cite{x} and \\cite{x}");
    expect(result.keys).toEqual(["x"]);
  });

  it("trims whitespace in keys", () => {
    const result = extractCitationKeysFromTex("\\cite{ a , b }");
    expect(result.keys).toEqual(["a", "b"]);
  });

  it("returns empty for text with no citations", () => {
    expect(extractCitationKeysFromTex("plain text")).toEqual({ keys: [] });
  });
});

describe("loadKnownPaperIds", () => {
  it("returns empty set when literature dir does not exist", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "citations-test-"));
    const paths: WritingProjectPaths = {
      projectDir: tmpDir,
      paperDir: path.join(tmpDir, "paper"),
      draftsDir: path.join(tmpDir, "paper", "drafts"),
      figuresDir: path.join(tmpDir, "paper", "figures"),
      literaturePapersDir: path.join(tmpDir, "literature", "papers"),
    };
    const ids = await loadKnownPaperIds(paths);
    expect(ids.size).toBe(0);
  });

  it("loads paper IDs from JSON files", async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "citations-test-"));
    const litDir = path.join(tmpDir, "literature", "papers");
    await fs.mkdir(litDir, { recursive: true });
    await fs.writeFile(
      path.join(litDir, "paper1.json"),
      JSON.stringify({ paperId: "id-1" }),
      "utf8",
    );
    await fs.writeFile(
      path.join(litDir, "paper2.json"),
      JSON.stringify({ paperId: "id-2" }),
      "utf8",
    );
    const paths: WritingProjectPaths = {
      projectDir: tmpDir,
      paperDir: path.join(tmpDir, "paper"),
      draftsDir: path.join(tmpDir, "paper", "drafts"),
      figuresDir: path.join(tmpDir, "paper", "figures"),
      literaturePapersDir: litDir,
    };
    const ids = await loadKnownPaperIds(paths);
    expect(ids.has("id-1")).toBe(true);
    expect(ids.has("id-2")).toBe(true);
    expect(ids.size).toBe(2);
  });
});

describe("verifyCitationKeys", () => {
  it("reports missing keys", () => {
    const known = new Set(["a", "b"]);
    const result = verifyCitationKeys(["a", "c"], known);
    expect(result.allCitationsValid).toBe(false);
    expect(result.missing).toEqual(["c"]);
  });

  it("reports all valid when no missing", () => {
    const known = new Set(["x", "y"]);
    const result = verifyCitationKeys(["x", "y"], known);
    expect(result.allCitationsValid).toBe(true);
    expect(result.missing).toEqual([]);
  });
});
