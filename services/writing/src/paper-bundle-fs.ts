import fs from "node:fs/promises";
import { validatePaperDraft, type PaperDraft } from "@deepscholar/contracts";
import { createPlaceholderBibEntries, renderBibTeX } from "./bibtex.ts";
import { extractCitationKeysFromTex, loadKnownPaperIds, verifyCitationKeys } from "./citations.ts";
import { renderPaperMainTex } from "./latex-template.ts";
import {
  resolveDeepScholarHome,
  resolvePaperDraftPaths,
  resolveWritingProjectPaths,
  type PaperDraftPaths,
} from "./writing-paths.ts";

export type WrittenPaperBundle = {
  readonly draft: PaperDraft;
  readonly paths: PaperDraftPaths;
  readonly mainTex: string;
  readonly refsBib: string;
  readonly extractedCitationKeys: readonly string[];
};

export type WritePaperBundleResult = {
  readonly bundle: WrittenPaperBundle;
  readonly citationCheck: {
    readonly allCitationsValid: boolean;
    readonly missing: readonly string[];
  };
};

export type WritePaperBundleOptions = {
  readonly homeDir?: string;
  readonly draft: PaperDraft;
  readonly bibYear: string;
};

function issueSummary(draft: PaperDraft): string {
  return validatePaperDraft(draft)
    .map((issue) => `${issue.field}:${issue.message}`)
    .join(", ");
}

function draftWithPaths(draft: PaperDraft, paths: PaperDraftPaths): PaperDraft {
  return {
    ...draft,
    mainTexPath: paths.mainTexPath,
    refsBibPath: paths.refsBibPath,
    compiledPdfPath: paths.compiledPdfPath,
    compileLogPath: paths.compileLogPath,
  };
}

export async function writePaperBundle(
  options: WritePaperBundleOptions,
): Promise<WritePaperBundleResult> {
  const issues = validatePaperDraft(options.draft);
  if (issues.length > 0) {
    throw new Error(`PaperDraft 校验失败，拒绝落盘: ${issueSummary(options.draft)}`);
  }

  const home = resolveDeepScholarHome(options.homeDir);
  const projectPaths = resolveWritingProjectPaths(home, options.draft.projectId);
  const paths = resolvePaperDraftPaths(projectPaths, options.draft.draftId);

  await fs.mkdir(projectPaths.draftsDir, { recursive: true });
  await fs.mkdir(projectPaths.figuresDir, { recursive: true });
  await fs.mkdir(paths.draftDir, { recursive: true });

  const mainTex = renderPaperMainTex(options.draft);
  const extracted = extractCitationKeysFromTex(mainTex).keys;
  const refsBib = renderBibTeX(createPlaceholderBibEntries(extracted, options.bibYear));

  const updatedDraft = draftWithPaths(options.draft, paths);
  await fs.writeFile(paths.mainTexPath, mainTex, "utf8");
  await fs.writeFile(paths.refsBibPath, refsBib, "utf8");
  await fs.writeFile(paths.draftJsonPath, JSON.stringify(updatedDraft, null, 2), "utf8");

  const knownIds = await loadKnownPaperIds(projectPaths);
  const citationCheck = verifyCitationKeys(extracted, knownIds);

  return {
    bundle: { draft: updatedDraft, paths, mainTex, refsBib, extractedCitationKeys: extracted },
    citationCheck,
  };
}
