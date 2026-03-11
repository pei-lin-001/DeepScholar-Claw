function isNonEmptyText(value: string): boolean {
  return value.trim().length > 0;
}

export type BibTeXEntry = {
  readonly key: string;
  readonly title: string;
  readonly author: string;
  readonly year: string;
  readonly note?: string;
};

function bibEscape(value: string): string {
  return value.replaceAll("{", "\\{").replaceAll("}", "\\}");
}

function renderBibTeXEntry(entry: BibTeXEntry): string {
  const base = [
    `@misc{${entry.key},`,
    `  title = {${bibEscape(entry.title)}},`,
    `  author = {${bibEscape(entry.author)}},`,
    `  year = {${bibEscape(entry.year)}},`,
  ];
  if (entry.note) {
    base.push(`  note = {${bibEscape(entry.note)}},`);
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
