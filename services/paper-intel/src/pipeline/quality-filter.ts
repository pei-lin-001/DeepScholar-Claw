import type { RawPaper } from "../sources/types.ts";

export type PaperQualityPolicy = {
  readonly minYear: number;
  readonly requireAbstractOrTldr: boolean;
  readonly requireOpenAccessPdf: boolean;
};

export type PaperQualityDropReason =
  | "missing-title"
  | "missing-year"
  | "too-old"
  | "missing-abstract"
  | "missing-open-access-pdf";

export type PaperQualityDecision = {
  readonly paper: RawPaper;
  readonly keep: boolean;
  readonly reasons: readonly PaperQualityDropReason[];
};

const DEFAULT_MIN_YEAR = 2018;

export function createDefaultQualityPolicy(): PaperQualityPolicy {
  return {
    minYear: DEFAULT_MIN_YEAR,
    requireAbstractOrTldr: true,
    requireOpenAccessPdf: false,
  };
}

function decisionForPaper(paper: RawPaper, policy: PaperQualityPolicy): PaperQualityDecision {
  const reasons: PaperQualityDropReason[] = [];
  if (paper.title.trim().length === 0) {
    reasons.push("missing-title");
  }
  if (!paper.year) {
    reasons.push("missing-year");
  }
  if (paper.year && paper.year < policy.minYear) {
    reasons.push("too-old");
  }
  const hasAbstractOrTldr = Boolean(paper.abstract?.trim() || paper.tldr?.trim());
  if (policy.requireAbstractOrTldr && !hasAbstractOrTldr) {
    reasons.push("missing-abstract");
  }
  if (policy.requireOpenAccessPdf && !paper.openAccessPdfUrl) {
    reasons.push("missing-open-access-pdf");
  }
  return { paper, keep: reasons.length === 0, reasons };
}

export function filterPapersByQuality(
  papers: readonly RawPaper[],
  policy: PaperQualityPolicy,
): readonly PaperQualityDecision[] {
  return papers.map((paper) => decisionForPaper(paper, policy));
}
