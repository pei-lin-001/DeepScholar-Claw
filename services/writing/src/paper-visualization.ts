import fs from "node:fs/promises";
import path from "node:path";
import {
  safeIdForFileName,
  validatePaperDraft,
  type PaperDraft,
} from "@deepscholar/contracts";
import { resolveRunPaths } from "../../runner/src/runner-paths.ts";
import { writePaperBundle } from "./paper-bundle-fs.ts";
import {
  applyVisualizationBlock,
  requireVisualizationSection,
  type VisualizationSectionId,
} from "./paper-visualization-draft.ts";
import {
  renderVisualizationChart,
  renderVisualizationScript,
  renderVisualizationTable,
  type PaperVisualizationSpec,
  type VisualizationMetricRow,
} from "./paper-visualization-render.ts";
import {
  resolveDeepScholarHome,
  resolvePaperDraftPaths,
  resolveWritingProjectPaths,
} from "./writing-paths.ts";

export type GeneratePaperVisualizationOptions = {
  readonly homeDir?: string;
  readonly projectId: string;
  readonly draftId: string;
  readonly visualId: string;
  readonly runIds: readonly string[];
  readonly metricNames: readonly string[];
  readonly caption: string;
  readonly section?: VisualizationSectionId;
  readonly narrative?: string;
  readonly bibYear: string;
};

export type GeneratePaperVisualizationResult = {
  readonly draft: PaperDraft;
  readonly visualDir: string;
  readonly specPath: string;
  readonly sourceMetricsPath: string;
  readonly renderScriptPath: string;
  readonly tableTexPath: string;
  readonly chartTexPath: string;
  readonly tableRef: string;
  readonly figureRef: string;
};

type VisualizationContext = {
  readonly section: VisualizationSectionId;
  readonly rows: readonly VisualizationMetricRow[];
  readonly draft: PaperDraft;
  readonly nextDraft: PaperDraft;
  readonly spec: PaperVisualizationSpec;
  readonly visualDir: string;
};

type VisualizationArtifactPaths = {
  readonly specPath: string;
  readonly sourceMetricsPath: string;
  readonly renderScriptPath: string;
  readonly tableTexPath: string;
  readonly chartTexPath: string;
};

export type { VisualizationSectionId } from "./paper-visualization-draft.ts";

function requireNonEmptyList(values: readonly string[], field: string): void {
  if (values.length === 0 || values.some((value) => value.trim().length === 0)) {
    throw new Error(`${field} 不能为空`);
  }
}

function assertVisualizationInput(options: GeneratePaperVisualizationOptions): void {
  requireNonEmptyList(options.runIds, "run-ids");
  requireNonEmptyList(options.metricNames, "metrics");
  if (!options.caption.trim()) {
    throw new Error("caption 不能为空");
  }
}

async function loadDraft(
  homeDir: string | undefined,
  projectId: string,
  draftId: string,
): Promise<PaperDraft> {
  const home = resolveDeepScholarHome(homeDir);
  const projectPaths = resolveWritingProjectPaths(home, projectId);
  const draftPaths = resolvePaperDraftPaths(projectPaths, draftId);
  const raw = JSON.parse(await fs.readFile(draftPaths.draftJsonPath, "utf8")) as PaperDraft;
  const issues = validatePaperDraft(raw);
  if (issues.length > 0) {
    throw new Error(
      `draft.json 不是合法 PaperDraft: ${issues.map((issue) => `${issue.field}:${issue.message}`).join(", ")}`,
    );
  }
  return raw;
}

function requireMetricValue(metrics: Record<string, unknown>, runId: string, metricName: string): number {
  const value = metrics[metricName];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`run=${runId} 的 metrics.${metricName} 不是有限数字`);
  }
  return value;
}

function pickMetrics(
  metrics: Record<string, unknown>,
  runId: string,
  metricNames: readonly string[],
): Readonly<Record<string, number>> {
  return Object.fromEntries(
    metricNames.map((metricName) => [metricName, requireMetricValue(metrics, runId, metricName)]),
  );
}

async function loadMetricRows(
  homeDir: string | undefined,
  projectId: string,
  runIds: readonly string[],
  metricNames: readonly string[],
): Promise<readonly VisualizationMetricRow[]> {
  const home = resolveDeepScholarHome(homeDir);
  return await Promise.all(
    runIds.map(async (runId) => {
      const paths = resolveRunPaths(home, projectId, runId);
      const metrics = JSON.parse(
        await fs.readFile(paths.metricsPath, "utf8"),
      ) as Record<string, unknown>;
      return { runId, metrics: pickMetrics(metrics, runId, metricNames) };
    }),
  );
}

function createVisualSpec(
  options: GeneratePaperVisualizationOptions,
  section: VisualizationSectionId,
): PaperVisualizationSpec {
  const safeVisualId = safeIdForFileName(options.visualId, "visualId");
  return {
    visualId: safeVisualId,
    metricNames: options.metricNames,
    primaryMetric: options.metricNames[0] ?? "",
    caption: options.caption,
    section,
    tableRef: `tab:${safeVisualId}`,
    figureRef: `fig:${safeVisualId}`,
    generatedAt: new Date().toISOString(),
  };
}

function relativeVisualDir(draftDir: string, visualDir: string): string {
  return path.relative(draftDir, visualDir).split(path.sep).join("/");
}

function buildNextDraft(
  draft: PaperDraft,
  section: VisualizationSectionId,
  spec: PaperVisualizationSpec,
  narrative: string | undefined,
  relativeDir: string,
): PaperDraft {
  return applyVisualizationBlock(draft, section, {
    visualId: spec.visualId,
    caption: spec.caption,
    metricNames: spec.metricNames,
    tableRef: spec.tableRef,
    figureRef: spec.figureRef,
    narrative,
    relativeDir,
  });
}

async function prepareVisualizationContext(
  options: GeneratePaperVisualizationOptions,
): Promise<VisualizationContext> {
  const section = requireVisualizationSection(options.section);
  const draft = await loadDraft(options.homeDir, options.projectId, options.draftId);
  const rows = await loadMetricRows(
    options.homeDir,
    options.projectId,
    options.runIds,
    options.metricNames,
  );
  const home = resolveDeepScholarHome(options.homeDir);
  const projectPaths = resolveWritingProjectPaths(home, options.projectId);
  const draftPaths = resolvePaperDraftPaths(projectPaths, options.draftId);
  const spec = createVisualSpec(options, section);
  const visualDir = path.join(projectPaths.figuresDir, spec.visualId);
  const nextDraft = buildNextDraft(
    draft,
    section,
    spec,
    options.narrative,
    relativeVisualDir(draftPaths.draftDir, visualDir),
  );
  return { section, rows, draft, nextDraft, spec, visualDir };
}

function resolveVisualizationArtifactPaths(visualDir: string): VisualizationArtifactPaths {
  return {
    specPath: path.join(visualDir, "visual-spec.json"),
    sourceMetricsPath: path.join(visualDir, "source-metrics.json"),
    renderScriptPath: path.join(visualDir, "render-visual.mjs"),
    tableTexPath: path.join(visualDir, "table.tex"),
    chartTexPath: path.join(visualDir, "chart.tex"),
  };
}

async function writeVisualizationArtifacts(
  visualDir: string,
  spec: PaperVisualizationSpec,
  rows: readonly VisualizationMetricRow[],
): Promise<VisualizationArtifactPaths> {
  const paths = resolveVisualizationArtifactPaths(visualDir);
  await fs.mkdir(visualDir, { recursive: true });
  await fs.writeFile(paths.specPath, JSON.stringify(spec, null, 2), "utf8");
  await fs.writeFile(paths.sourceMetricsPath, JSON.stringify(rows, null, 2), "utf8");
  await fs.writeFile(paths.renderScriptPath, renderVisualizationScript(), "utf8");
  await fs.writeFile(paths.tableTexPath, renderVisualizationTable(spec, rows), "utf8");
  await fs.writeFile(paths.chartTexPath, renderVisualizationChart(spec, rows), "utf8");
  return paths;
}

async function writeVisualizedDraft(
  options: GeneratePaperVisualizationOptions,
  draft: PaperDraft,
): Promise<PaperDraft> {
  const result = await writePaperBundle({
    homeDir: options.homeDir,
    draft,
    bibYear: options.bibYear,
  });
  return result.bundle.draft;
}

function buildVisualizationResult(
  draft: PaperDraft,
  visualDir: string,
  spec: PaperVisualizationSpec,
  paths: VisualizationArtifactPaths,
): GeneratePaperVisualizationResult {
  return {
    draft,
    visualDir,
    specPath: paths.specPath,
    sourceMetricsPath: paths.sourceMetricsPath,
    renderScriptPath: paths.renderScriptPath,
    tableTexPath: paths.tableTexPath,
    chartTexPath: paths.chartTexPath,
    tableRef: spec.tableRef,
    figureRef: spec.figureRef,
  };
}

export async function generatePaperVisualization(
  options: GeneratePaperVisualizationOptions,
): Promise<GeneratePaperVisualizationResult> {
  assertVisualizationInput(options);
  const context = await prepareVisualizationContext(options);
  const artifactPaths = await writeVisualizationArtifacts(
    context.visualDir,
    context.spec,
    context.rows,
  );
  const draft = await writeVisualizedDraft(options, context.nextDraft);
  return buildVisualizationResult(draft, context.visualDir, context.spec, artifactPaths);
}
