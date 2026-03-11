import type { Command } from "commander";
import {
  createPaperDraft,
  type PaperVenueTemplateId,
} from "../../packages/deepscholar-contracts/src/index.ts";
import { recordDraftWritten } from "../../services/orchestrator/src/index.js";
import { compilePaperDraft, writePaperBundle } from "../../services/writing/src/index.js";
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
