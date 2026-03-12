import { isIsoTimestamp, type IsoTimestamp } from "./time.ts";
import {
  isFiniteNumber,
  isNonEmptyText,
  isOneOf,
  pushIf,
  type ValidationIssue,
} from "./validation.ts";

export type PaperVenueTemplateId = "arxiv" | "neurips" | "icml" | "iclr" | "cvpr" | "acl";

export const PAPER_VENUE_TEMPLATES: readonly PaperVenueTemplateId[] = [
  "arxiv",
  "neurips",
  "icml",
  "iclr",
  "cvpr",
  "acl",
];

export function isPaperVenueTemplateId(value: string): value is PaperVenueTemplateId {
  return isOneOf(value, PAPER_VENUE_TEMPLATES);
}

export type PaperDraftStatus = "draft" | "compiled" | "compile_failed";

export const PAPER_DRAFT_STATUSES: readonly PaperDraftStatus[] = [
  "draft",
  "compiled",
  "compile_failed",
];

export function isPaperDraftStatus(value: string): value is PaperDraftStatus {
  return isOneOf(value, PAPER_DRAFT_STATUSES);
}

export type PaperFigure = {
  readonly figureId: string;
  readonly path: string;
  readonly caption: string;
  readonly latexRef: string;
};

export type PaperSections = {
  readonly abstract: string;
  readonly introduction: string;
  readonly relatedWork: string;
  readonly methodology: string;
  readonly experiments: string;
  readonly results: string;
  readonly discussion: string;
  readonly conclusion: string;
};

export type PaperDraft = {
  readonly draftId: string;
  readonly projectId: string;
  readonly planId: string;
  readonly title: string;
  readonly venue: PaperVenueTemplateId;
  readonly status: PaperDraftStatus;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly sections: PaperSections;
  readonly citations: readonly string[];
  readonly figures: readonly PaperFigure[];
  readonly mainTexPath?: string;
  readonly refsBibPath?: string;
  readonly compiledPdfPath?: string;
  readonly compileLogPath?: string;
};

export type CreatePaperDraftInput = {
  readonly draftId: string;
  readonly projectId: string;
  readonly planId: string;
  readonly title: string;
  readonly venue: PaperVenueTemplateId;
  readonly status: PaperDraftStatus;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly sections?: Partial<PaperSections>;
  readonly citations?: readonly string[];
  readonly figures?: readonly PaperFigure[];
  readonly mainTexPath?: string;
  readonly refsBibPath?: string;
  readonly compiledPdfPath?: string;
  readonly compileLogPath?: string;
};

function normalizeSections(sections?: Partial<PaperSections>): PaperSections {
  const safe = (value: unknown) => (typeof value === "string" ? value : "");
  return {
    abstract: safe(sections?.abstract),
    introduction: safe(sections?.introduction),
    relatedWork: safe(sections?.relatedWork),
    methodology: safe(sections?.methodology),
    experiments: safe(sections?.experiments),
    results: safe(sections?.results),
    discussion: safe(sections?.discussion),
    conclusion: safe(sections?.conclusion),
  };
}

export function createPaperDraft(input: CreatePaperDraftInput): PaperDraft {
  return {
    draftId: input.draftId,
    projectId: input.projectId,
    planId: input.planId,
    title: input.title,
    venue: input.venue,
    status: input.status,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    sections: normalizeSections(input.sections),
    citations: input.citations ?? [],
    figures: input.figures ?? [],
    mainTexPath: input.mainTexPath,
    refsBibPath: input.refsBibPath,
    compiledPdfPath: input.compiledPdfPath,
    compileLogPath: input.compileLogPath,
  };
}

function validateFigure(figure: PaperFigure): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(figure.figureId), "figures.figureId", "figureId 不能为空");
  pushIf(issues, !isNonEmptyText(figure.path), "figures.path", "path 不能为空");
  pushIf(issues, !isNonEmptyText(figure.caption), "figures.caption", "caption 不能为空");
  pushIf(issues, !isNonEmptyText(figure.latexRef), "figures.latexRef", "latexRef 不能为空");
  return issues;
}

function validateSections(sections: PaperSections): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fields: Array<[keyof PaperSections, unknown]> = [
    ["abstract", sections.abstract],
    ["introduction", sections.introduction],
    ["relatedWork", sections.relatedWork],
    ["methodology", sections.methodology],
    ["experiments", sections.experiments],
    ["results", sections.results],
    ["discussion", sections.discussion],
    ["conclusion", sections.conclusion],
  ];
  for (const [key, value] of fields) {
    pushIf(issues, typeof value !== "string", `sections.${String(key)}`, "章节内容必须是字符串");
  }
  return issues;
}

function validatePathMaybe(
  pathValue: string | undefined,
  field: string,
  issues: ValidationIssue[],
): void {
  if (pathValue === undefined) {
    return;
  }
  pushIf(issues, !isNonEmptyText(pathValue), field, `${field} 不能为空`);
}

export function validatePaperDraft(draft: PaperDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(draft.draftId), "draftId", "draftId 不能为空");
  pushIf(issues, !isNonEmptyText(draft.projectId), "projectId", "projectId 不能为空");
  pushIf(issues, !isNonEmptyText(draft.planId), "planId", "planId 不能为空");
  pushIf(issues, !isNonEmptyText(draft.title), "title", "title 不能为空");
  pushIf(
    issues,
    !isOneOf(draft.venue, PAPER_VENUE_TEMPLATES),
    "venue",
    `venue 必须是 ${PAPER_VENUE_TEMPLATES.join("/")}`,
  );
  pushIf(
    issues,
    !isOneOf(draft.status, PAPER_DRAFT_STATUSES),
    "status",
    `status 必须是 ${PAPER_DRAFT_STATUSES.join("/")}`,
  );
  pushIf(issues, !isIsoTimestamp(draft.createdAt), "createdAt", "createdAt 必须是合法时间戳");
  pushIf(issues, !isIsoTimestamp(draft.updatedAt), "updatedAt", "updatedAt 必须是合法时间戳");

  issues.push(...validateSections(draft.sections));
  for (const [idx, paperId] of draft.citations.entries()) {
    pushIf(issues, !isNonEmptyText(paperId), `citations[${idx}]`, "citation 不能为空");
  }
  for (const figure of draft.figures) {
    issues.push(...validateFigure(figure));
  }

  validatePathMaybe(draft.mainTexPath, "mainTexPath", issues);
  validatePathMaybe(draft.refsBibPath, "refsBibPath", issues);
  validatePathMaybe(draft.compiledPdfPath, "compiledPdfPath", issues);
  validatePathMaybe(draft.compileLogPath, "compileLogPath", issues);

  return issues;
}

export type PaperCompileResult = {
  readonly status: "success" | "failed" | "timeout";
  readonly exitCode?: number;
  readonly durationMs: number;
  readonly compiler: "docker" | "unknown";
  readonly outputPdfPath?: string;
  readonly compileLogPath?: string;
};

const PAPER_COMPILE_STATUSES = ["success", "failed", "timeout"] as const;
const PAPER_COMPILERS = ["docker", "unknown"] as const;

export function validatePaperCompileResult(result: PaperCompileResult): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(
    issues,
    !isOneOf(result.status, PAPER_COMPILE_STATUSES),
    "status",
    "status 必须是 success/failed/timeout",
  );
  pushIf(issues, !isFiniteNumber(result.durationMs), "durationMs", "durationMs 必须是有限数字");
  pushIf(
    issues,
    !isOneOf(result.compiler, PAPER_COMPILERS),
    "compiler",
    `compiler 必须是 ${PAPER_COMPILERS.join("/")}`,
  );
  if (result.exitCode !== undefined) {
    pushIf(issues, !Number.isInteger(result.exitCode), "exitCode", "exitCode 必须是整数");
  }
  if (result.outputPdfPath !== undefined) {
    pushIf(
      issues,
      !isNonEmptyText(result.outputPdfPath),
      "outputPdfPath",
      "outputPdfPath 不能为空",
    );
  }
  if (result.compileLogPath !== undefined) {
    pushIf(
      issues,
      !isNonEmptyText(result.compileLogPath),
      "compileLogPath",
      "compileLogPath 不能为空",
    );
  }
  return issues;
}
