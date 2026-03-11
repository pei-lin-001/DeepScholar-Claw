import { describe, expect, it } from "vitest";
import { createPlaceholderBibEntries, renderBibTeX } from "./bibtex.ts";

describe("createPlaceholderBibEntries", () => {
  it("creates entries from citation keys", () => {
    const entries = createPlaceholderBibEntries(["smith2024", "jones2023"], "2024");
    expect(entries).toHaveLength(2);
    expect(entries[0].key).toBe("smith2024");
    expect(entries[0].year).toBe("2024");
    expect(entries[1].key).toBe("jones2023");
  });

  it("filters out empty/whitespace-only keys", () => {
    const entries = createPlaceholderBibEntries(["valid", "", "  ", "also-valid"], "2024");
    expect(entries).toHaveLength(2);
    expect(entries[0].key).toBe("valid");
    expect(entries[1].key).toBe("also-valid");
  });

  it("trims whitespace from keys", () => {
    const entries = createPlaceholderBibEntries(["  padded  "], "2024");
    expect(entries).toHaveLength(1);
    expect(entries[0].key).toBe("padded");
  });

  it("returns empty array for empty input", () => {
    expect(createPlaceholderBibEntries([], "2024")).toEqual([]);
  });
});

describe("renderBibTeX", () => {
  it("renders entries to BibTeX format", () => {
    const entries = createPlaceholderBibEntries(["key1"], "2024");
    const bib = renderBibTeX(entries);
    expect(bib).toContain("@misc{key1,");
    expect(bib).toContain("title = {Placeholder Reference (key1)}");
    expect(bib).toContain("year = {2024}");
  });

  it("escapes LaTeX special characters in fields", () => {
    const bib = renderBibTeX([
      { key: "test", title: "100% accuracy & more", author: "O'Brien", year: "2024" },
    ]);
    expect(bib).toContain("100\\% accuracy \\& more");
  });

  it("includes optional note field", () => {
    const entries = createPlaceholderBibEntries(["k"], "2024");
    const bib = renderBibTeX(entries);
    expect(bib).toContain("note = {");
  });
});
