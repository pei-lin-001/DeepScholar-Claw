import type { Command } from "commander";
import {
  createPaperDraft,
  type PaperVenueTemplateId,
} from "../../packages/deepscholar-contracts/src/index.ts";
import { recordDraftWritten } from "../../services/orchestrator/src/index.js";
import {
  compilePaperDraft,
  generatePaperVisualization,
  writePaperBundle,
} from "../../services/writing/src/index.js";
import { defaultRuntime } from "../runtime.js";
import { runCommandWithRuntime } from "./cli-utils.js";
import {
  parseNonEmptyText,
  printJsonOrSummary,
  type CliRuntime,
} from "./research-orchestrator-helpers.js";
import {
  DEFAULT_BIB_YEAR,
  DEFAULT_TEX_IMAGE,
  DEFAULT_TIMEOUT_SECONDS,
  DEFAULT_VENUE,
  createDefaultDeps,
  parsePositiveInt,
  requireStep,
  type Phase4CliDepsFactory,
} from "./research-phase4-shared.js";

export function registerPaperCli(
  research: Command,
  runtime: CliRuntime = defaultRuntime,
  depsFactory: Phase4CliDepsFactory = createDefaultDeps,
): void {
  const paper = research.command("paper").description("Paper bundle utilities (write/compile)");
  registerPaperWrite(paper, runtime, depsFactory);
  registerPaperVisualize(paper, runtime, depsFactory);
  registerPaperCompile(paper, runtime, depsFactory);
}

function registerPaperWrite(
  paper: Command,
  runtime: CliRuntime,
  depsFactory: Phase4CliDepsFactory,
): void {
  paper
    .command("write")
    .description("Render main.tex + refs.bib and persist paper draft bundle")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--draft-id <id>", "Draft id")
    .requiredOption("--plan-id <id>", "Plan id")
    .requiredOption("--title <text>", "Paper title")
    .option("--venue <id>", "arxiv | neurips | icml | iclr | cvpr | acl", DEFAULT_VENUE)
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--bib-year <yyyy>", "refs.bib placeholder year", DEFAULT_BIB_YEAR)
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runPaperWrite(opts, runtime, depsFactory));
    });
}

async function runPaperWrite(
  opts: Record<string, unknown>,
  runtime: CliRuntime,
  depsFactory: Phase4CliDepsFactory,
): Promise<void> {
  const deps = depsFactory(opts.home as string | undefined);
  const projectId = parseNonEmptyText(opts.projectId, "project-id");
  const project = await deps.orchestrator.projects.load(projectId);
  requireStep(project, "step10_paper_writing");
  if (!project.gates.resultsVerified) {
    throw new Error("结果尚未被验证（resultsVerified=false），不能写论文草稿包");
  }

  const nowIso = new Date().toISOString();
  const draft = createPaperDraft({
    draftId: parseNonEmptyText(opts.draftId, "draft-id"),
    projectId,
    planId: parseNonEmptyText(opts.planId, "plan-id"),
    title: parseNonEmptyText(opts.title, "title"),
    venue: parseNonEmptyText(opts.venue, "venue", DEFAULT_VENUE) as PaperVenueTemplateId,
    status: "draft",
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  const result = await writePaperBundle({
    homeDir: opts.home as string | undefined,
    draft,
    bibYear: parseNonEmptyText(opts.bibYear, "bib-year", DEFAULT_BIB_YEAR),
  });

  if (!result.citationCheck.allCitationsValid) {
    throw new Error(`引用校验失败，缺失 paperId: ${result.citationCheck.missing.join(", ")}`);
  }

  const out = { draft: result.bundle.draft, paths: result.bundle.paths };
  printJsonOrSummary(
    opts,
    out,
    `草稿包已落盘 | draftId=${draft.draftId} | main.tex 已生成`,
    runtime.log,
  );
}

function registerPaperVisualize(
  paper: Command,
  runtime: CliRuntime,
  depsFactory: Phase4CliDepsFactory,
): void {
  paper
    .command("visualize")
    .description("Generate table/chart evidence from run metrics and stitch it into draft")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--draft-id <id>", "Draft id")
    .requiredOption("--visual-id <id>", "Visualization id")
    .requiredOption("--run-ids <ids>", "Comma-separated run ids")
    .requiredOption("--metrics <names>", "Comma-separated metric names")
    .requiredOption("--caption <text>", "Caption shared by the generated table/chart")
    .option(
      "--section <name>",
      "Target section: abstract/introduction/relatedWork/methodology/experiments/results/discussion/conclusion",
      "results",
    )
    .option("--narrative <text>", "Narrative paragraph inserted above the generated evidence")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--bib-year <yyyy>", "refs.bib placeholder year", DEFAULT_BIB_YEAR)
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runPaperVisualize(opts, runtime, depsFactory));
    });
}

async function runPaperVisualize(
  opts: Record<string, unknown>,
  runtime: CliRuntime,
  depsFactory: Phase4CliDepsFactory,
): Promise<void> {
  const projectId = await requireVisualizableProject(depsFactory, opts);
  const result = await generatePaperVisualization(parseVisualizeOptions(opts, projectId));
  const out = buildVisualizeOutput(result);
  printJsonOrSummary(
    opts,
    out,
    `可视化证据已写入草稿 | draftId=${result.draft.draftId} | table=${result.tableRef} | figure=${result.figureRef}`,
    runtime.log,
  );
}

function registerPaperCompile(
  paper: Command,
  runtime: CliRuntime,
  depsFactory: Phase4CliDepsFactory,
): void {
  paper
    .command("compile")
    .description("Compile draft LaTeX via compiler and advance to Step11 on success")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--draft-id <id>", "Draft id")
    .option("--tex-image <name>", "Docker image containing latexmk", DEFAULT_TEX_IMAGE)
    .option("--timeout-seconds <n>", "Hard timeout seconds", String(DEFAULT_TIMEOUT_SECONDS))
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--actor-id <id>", "Audit actor id (human)", "human")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runPaperCompile(opts, runtime, depsFactory));
    });
}

async function runPaperCompile(
  opts: Record<string, unknown>,
  runtime: CliRuntime,
  depsFactory: Phase4CliDepsFactory,
): Promise<void> {
  const deps = depsFactory(opts.home as string | undefined);
  const projectId = parseNonEmptyText(opts.projectId, "project-id");
  const draftId = parseNonEmptyText(opts.draftId, "draft-id");
  const project = await deps.orchestrator.projects.load(projectId);
  requireStep(project, "step10_paper_writing");
  if (!project.gates.resultsVerified) {
    throw new Error("结果尚未被验证（resultsVerified=false），不能编译论文");
  }

  const compiler = deps.createLatexCompiler(
    parseNonEmptyText(opts.texImage, "tex-image", DEFAULT_TEX_IMAGE),
  );
  const result = await compilePaperDraft({
    homeDir: opts.home as string | undefined,
    projectId,
    draftId,
    timeoutMs:
      parsePositiveInt(opts.timeoutSeconds, "timeout-seconds", DEFAULT_TIMEOUT_SECONDS) * 1000,
    compiler,
  });

  const shouldAdvance = result.compile.status === "success";
  const next = shouldAdvance
    ? await recordDraftWritten(deps.orchestrator, {
        projectId,
        draftId,
        actorId: parseNonEmptyText(opts.actorId, "actor-id", "human"),
      })
    : project;

  const out = { compile: result.compile, project: next };
  const summary = shouldAdvance
    ? `编译成功 | 已进入步骤 ${next.step}`
    : `编译失败(${result.compile.status}) | 项目仍停留在 ${project.step}`;
  printJsonOrSummary(opts, out, summary, runtime.log);
}

function parseCsvValues(value: unknown, field: string): readonly string[] {
  return parseNonEmptyText(value, field)
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

async function requireVisualizableProject(
  depsFactory: Phase4CliDepsFactory,
  opts: Record<string, unknown>,
): Promise<string> {
  const deps = depsFactory(opts.home as string | undefined);
  const projectId = parseNonEmptyText(opts.projectId, "project-id");
  const project = await deps.orchestrator.projects.load(projectId);
  requireStep(project, "step10_paper_writing");
  if (!project.gates.resultsVerified) {
    throw new Error("结果尚未被验证（resultsVerified=false），不能生成论文可视化");
  }
  return projectId;
}

function parseVisualizeOptions(
  opts: Record<string, unknown>,
  projectId: string,
): Parameters<typeof generatePaperVisualization>[0] {
  return {
    homeDir: opts.home as string | undefined,
    projectId,
    draftId: parseNonEmptyText(opts.draftId, "draft-id"),
    visualId: parseNonEmptyText(opts.visualId, "visual-id"),
    runIds: parseCsvValues(opts.runIds, "run-ids"),
    metricNames: parseCsvValues(opts.metrics, "metrics"),
    caption: parseNonEmptyText(opts.caption, "caption"),
    section: parseNonEmptyText(opts.section, "section", "results") as
      | "abstract"
      | "introduction"
      | "relatedWork"
      | "methodology"
      | "experiments"
      | "results"
      | "discussion"
      | "conclusion",
    narrative:
      opts.narrative === undefined ? undefined : parseNonEmptyText(opts.narrative, "narrative"),
    bibYear: parseNonEmptyText(opts.bibYear, "bib-year", DEFAULT_BIB_YEAR),
  };
}

function buildVisualizeOutput(
  result: Awaited<ReturnType<typeof generatePaperVisualization>>,
) {
  return {
    draft: result.draft,
    visual: {
      visualDir: result.visualDir,
      specPath: result.specPath,
      sourceMetricsPath: result.sourceMetricsPath,
      renderScriptPath: result.renderScriptPath,
      tableTexPath: result.tableTexPath,
      chartTexPath: result.chartTexPath,
      tableRef: result.tableRef,
      figureRef: result.figureRef,
    },
  };
}
