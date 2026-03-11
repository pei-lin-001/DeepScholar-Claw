import fs from "node:fs/promises";
import path from "node:path";
import type { WritingProjectPaths } from "./writing-paths.ts";

export type CitationExtractionResult = {
  readonly keys: readonly string[];
};

export type CitationVerificationResult = {
  readonly allCitationsValid: boolean;
  readonly missing: readonly string[];
};

const CITE_COMMAND = /\\cite[a-zA-Z]*\{([^}]+)\}/g;

function isNonEmptyText(value: string): boolean {
  return value.trim().length > 0;
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function extractCitationKeysFromTex(tex: string): CitationExtractionResult {
  const matches: string[] = [];
  for (const match of tex.matchAll(CITE_COMMAND)) {
    matches.push(match[1] ?? "");
  }

  const exploded = matches
    .flatMap((raw) => raw.split(","))
    .map((key) => key.trim())
    .filter((key) => isNonEmptyText(key));
  return { keys: uniqueStrings(exploded) };
}

type StoredPaperId = {
  readonly paperId?: unknown;
};

async function loadPaperIdFromJson(filePath: string): Promise<string | null> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as StoredPaperId;
  const value = parsed.paperId;
  if (typeof value !== "string" || !isNonEmptyText(value)) {
    return null;
  }
  return value.trim();
}

export async function loadKnownPaperIds(projectPaths: WritingProjectPaths): Promise<Set<string>> {
  try {
    const entries = await fs.readdir(projectPaths.literaturePapersDir, { withFileTypes: true });
    const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json"));
    const ids = await Promise.all(
      files.map((entry) =>
        loadPaperIdFromJson(path.join(projectPaths.literaturePapersDir, entry.name)),
      ),
    );
    return new Set(ids.filter((value): value is string => value !== null));
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
      return new Set();
    }
    throw err;
  }
}

export function verifyCitationKeys(
  citationKeys: readonly string[],
  knownPaperIds: Set<string>,
): CitationVerificationResult {
  const missing = citationKeys.filter((key) => !knownPaperIds.has(key));
  return { allCitationsValid: missing.length === 0, missing };
}
