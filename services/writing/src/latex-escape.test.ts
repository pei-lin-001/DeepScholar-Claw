import { describe, expect, it } from "vitest";
import { escapeLatex } from "./latex-escape.ts";

describe("escapeLatex", () => {
  it("escapes all LaTeX special characters", () => {
    expect(escapeLatex("100% profit & loss")).toBe("100\\% profit \\& loss");
    expect(escapeLatex("$10 #1")).toBe("\\$10 \\#1");
    expect(escapeLatex("a_b {c}")).toBe("a\\_b \\{c\\}");
    expect(escapeLatex("x~y^z")).toBe("x\\textasciitilde{}y\\textasciicircum{}z");
    expect(escapeLatex("path\\to\\file")).toBe("path\\textbackslash{}to\\textbackslash{}file");
  });

  it("returns plain text unchanged", () => {
    expect(escapeLatex("hello world")).toBe("hello world");
    expect(escapeLatex("")).toBe("");
  });
});
