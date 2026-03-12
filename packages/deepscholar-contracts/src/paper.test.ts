import { describe, expect, it } from "vitest";
import { createPaperDraft, validatePaperCompileResult, validatePaperDraft } from "./index.ts";

describe("paper contracts", () => {
  it("creates a minimal draft and validates", () => {
    const draft = createPaperDraft({
      draftId: "d1",
      projectId: "p1",
      planId: "plan-1",
      title: "Demo Paper",
      venue: "arxiv",
      status: "draft",
      createdAt: "2026-03-11T00:00:00.000Z",
      updatedAt: "2026-03-11T00:00:01.000Z",
    });
    expect(validatePaperDraft(draft)).toEqual([]);
  });

  it("rejects invalid draft fields", () => {
    const bad = createPaperDraft({
      draftId: "",
      projectId: "",
      planId: "",
      title: "",
      venue: "nope" as never,
      status: "broken" as never,
      createdAt: "not-a-timestamp" as never,
      updatedAt: "not-a-timestamp" as never,
      citations: [""],
      figures: [{ figureId: "", path: "", caption: "", latexRef: "" }],
      mainTexPath: "",
    });
    expect(validatePaperDraft(bad).length).toBeGreaterThan(0);
  });

  it("validates compile result", () => {
    expect(
      validatePaperCompileResult({
        status: "success",
        durationMs: 123,
        compiler: "docker",
        exitCode: 0,
        outputPdfPath: "/tmp/out.pdf",
        compileLogPath: "/tmp/latex.log",
      }),
    ).toEqual([]);

    const issues = validatePaperCompileResult({
      status: "ok" as never,
      durationMs: Number.NaN,
      compiler: "nope" as never,
      exitCode: 3.14,
      outputPdfPath: "",
    });
    expect(issues.length).toBeGreaterThan(0);
  });
});
