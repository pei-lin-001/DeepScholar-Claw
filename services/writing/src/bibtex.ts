import { isNonEmptyText } from "@deepscholar/contracts";
import { escapeLatex } from "./latex-escape.ts";

export type BibTeXEntry = {
  readonly key: string;
  readonly title: string;
  readonly author: string;
  readonly year: string;
  readonly note?: string;
};

function renderBibTeXEntry(entry: BibTeXEntry): string {
  const base = [
    `@misc{${entry.key},`,
    `  title = {${escapeLatex(entry.title)}},`,
    `  author = {${escapeLatex(entry.author)}},`,
    `  year = {${escapeLatex(entry.year)}},`,
  ];
  if (entry.note) {
    base.push(`  note = {${escapeLatex(entry.note)}},`);
  }
  base.push("}");
  return base.join("\n");
}

export function createPlaceholderBibEntries(keys: readonly string[], year: string): BibTeXEntry[] {
  return keys
    .map((key) => key.trim())
    .filter((key) => isNonEmptyText(key))
    .map((key) => ({
      key,
      title: `Placeholder Reference (${key})`,
      author: "DeepScholar-Claw",
      year,
      note: "Auto-generated placeholder; replace with real BibTeX when metadata is available.",
    }));
}

export function renderBibTeX(entries: readonly BibTeXEntry[]): string {
  return entries.map((entry) => renderBibTeXEntry(entry)).join("\n\n") + "\n";
}
