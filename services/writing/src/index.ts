import { pathToFileURL } from "node:url";
import type { ServiceDescriptor } from "@deepscholar/contracts";

export { renderPaperMainTex } from "./latex-template.ts";
export { escapeLatex } from "./latex-escape.ts";
export { createPlaceholderBibEntries, renderBibTeX, type BibTeXEntry } from "./bibtex.ts";
export {
  extractCitationKeysFromTex,
  loadKnownPaperIds,
  verifyCitationKeys,
  type CitationExtractionResult,
  type CitationVerificationResult,
} from "./citations.ts";
export {
  resolveDeepScholarHome,
  resolvePaperDraftPaths,
  resolveWritingProjectPaths,
  type DeepScholarHome,
  type PaperDraftPaths,
  type WritingProjectPaths,
} from "./writing-paths.ts";
export {
  writePaperBundle,
  type WritePaperBundleOptions,
  type WritePaperBundleResult,
} from "./paper-bundle-fs.ts";
export {
  generatePaperVisualization,
  type GeneratePaperVisualizationOptions,
  type GeneratePaperVisualizationResult,
  type VisualizationSectionId,
} from "./paper-visualization.ts";
export {
  compilePaperDraft,
  type CompilePaperDraftOptions,
  type CompilePaperDraftResult,
} from "./latex-compile.ts";
export {
  createDockerLatexCompiler,
  createNodeCommandExecutor,
  type CommandExecutor,
  type CommandResult,
  type DockerLatexCompilerOptions,
  type LatexCompiler,
  type LatexCompileInput,
} from "./latex-compiler.ts";

export const writingService: ServiceDescriptor = {
  id: "writing",
  displayName: "Paper Writing",
  owns: [
    "latex template rendering",
    "paper bundle persistence",
    "citation consistency checks",
    "metrics-to-paper visualization",
  ],
  consumes: ["project plan", "validated results", "local literature store"],
  produces: ["main.tex", "refs.bib", "paper draft bundle", "table.tex/chart.tex visual evidence"],
  outOfScope: ["full LaTeX compilation", "LLM prompt tuning", "human submission"],
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  console.log(JSON.stringify(writingService, null, 2));
}
