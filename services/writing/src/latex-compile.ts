import fs from "node:fs/promises";
import path from "node:path";
import {
  nowIsoTimestamp,
  validatePaperCompileResult,
  validatePaperDraft,
  type PaperCompileResult,
  type PaperDraft,
} from "@deepscholar/contracts";
import type { LatexCompiler } from "./latex-compiler.ts";
import {
  resolveDeepScholarHome,
  resolvePaperDraftPaths,
  resolveWritingProjectPaths,
  type PaperDraftPaths,
} from "./writing-paths.ts";

export type CompilePaperDraftOptions = {
  readonly homeDir?: string;
  readonly projectId: string;
  readonly draftId: string;
  readonly timeoutMs: number;
  readonly compiler: LatexCompiler;
};

export type CompilePaperDraftResult = {
  readonly draft: PaperDraft;
  readonly paths: PaperDraftPaths;
  readonly compile: PaperCompileResult;
};

function issueSummary(draft: PaperDraft): string {
  return validatePaperDraft(draft)
    .map((issue) => `${issue.field}:${issue.message}`)
    .join(", ");
}

async function loadDraftJson(draftJsonPath: string): Promise<PaperDraft> {
  const raw = await fs.readFile(draftJsonPath, "utf8");
  return JSON.parse(raw) as PaperDraft;
}

async function ensurePdfExists(pdfPath: string): Promise<void> {
  try {
    const stat = await fs.stat(pdfPath);
    if (!stat.isFile()) {
      throw new Error("不是文件");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`编译声称成功但 PDF 不存在: ${pdfPath} (${message})`, { cause: err });
  }
}

function draftWithCompileResult(draft: PaperDraft, compile: PaperCompileResult): PaperDraft {
  const status = compile.status === "success" ? "compiled" : "compile_failed";
  return {
    ...draft,
    status,
    updatedAt: nowIsoTimestamp(),
    compiledPdfPath: compile.outputPdfPath ?? draft.compiledPdfPath,
    compileLogPath: compile.compileLogPath ?? draft.compileLogPath,
  };
}

export async function compilePaperDraft(
  options: CompilePaperDraftOptions,
): Promise<CompilePaperDraftResult> {
  const home = resolveDeepScholarHome(options.homeDir);
  const projectPaths = resolveWritingProjectPaths(home, options.projectId);
  const paths = resolvePaperDraftPaths(projectPaths, options.draftId);

  const draft = await loadDraftJson(paths.draftJsonPath);
  const issues = validatePaperDraft(draft);
  if (issues.length > 0) {
    throw new Error(`PaperDraft 校验失败，拒绝编译: ${issueSummary(draft)}`);
  }

  const compile = await options.compiler.compile({
    draftDir: paths.draftDir,
    mainTexPath: paths.mainTexPath,
    compiledPdfPath: paths.compiledPdfPath,
    compileLogPath: paths.compileLogPath,
    timeoutMs: options.timeoutMs,
  });

  const compileIssues = validatePaperCompileResult(compile);
  if (compileIssues.length > 0) {
    throw new Error(
      `PaperCompileResult 校验失败: ${compileIssues.map((i) => `${i.field}:${i.message}`).join(", ")}`,
    );
  }

  if (compile.status === "success") {
    await ensurePdfExists(compile.outputPdfPath ?? paths.compiledPdfPath);
  }

  const updated = draftWithCompileResult(draft, compile);
  await fs.mkdir(path.dirname(paths.draftJsonPath), { recursive: true });
  await fs.writeFile(paths.draftJsonPath, JSON.stringify(updated, null, 2), "utf8");

  return { draft: updated, paths, compile };
}
