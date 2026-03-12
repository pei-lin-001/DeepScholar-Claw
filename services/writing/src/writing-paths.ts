import os from "node:os";
import path from "node:path";
import { safeIdForFileName } from "@deepscholar/contracts";

export type DeepScholarHome = {
  readonly rootDir: string;
};

export type WritingProjectPaths = {
  readonly projectDir: string;
  readonly paperDir: string;
  readonly draftsDir: string;
  readonly figuresDir: string;
  readonly literaturePapersDir: string;
};

export type PaperDraftPaths = {
  readonly draftDir: string;
  readonly draftJsonPath: string;
  readonly mainTexPath: string;
  readonly refsBibPath: string;
  readonly compiledPdfPath: string;
  readonly compileLogPath: string;
};

export function resolveDeepScholarHome(rootDir?: string): DeepScholarHome {
  const resolvedRoot = rootDir ?? path.join(os.homedir(), ".deepscholar");
  return { rootDir: resolvedRoot };
}

export function resolveWritingProjectPaths(
  home: DeepScholarHome,
  projectId: string,
): WritingProjectPaths {
  const safeProjectId = safeIdForFileName(projectId, "projectId");
  const projectDir = path.join(home.rootDir, "projects", safeProjectId);
  const paperDir = path.join(projectDir, "paper");
  return {
    projectDir,
    paperDir,
    draftsDir: path.join(paperDir, "drafts"),
    figuresDir: path.join(paperDir, "figures"),
    literaturePapersDir: path.join(projectDir, "literature", "papers"),
  };
}

export function resolvePaperDraftPaths(
  projectPaths: WritingProjectPaths,
  draftId: string,
): PaperDraftPaths {
  const safeDraftId = safeIdForFileName(draftId, "draftId");
  const draftDir = path.join(projectPaths.draftsDir, safeDraftId);
  return {
    draftDir,
    draftJsonPath: path.join(draftDir, "draft.json"),
    mainTexPath: path.join(draftDir, "main.tex"),
    refsBibPath: path.join(draftDir, "refs.bib"),
    compiledPdfPath: path.join(draftDir, "compiled.pdf"),
    compileLogPath: path.join(draftDir, "compile.log"),
  };
}
