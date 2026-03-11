import crypto from "node:crypto";
import type { Command } from "commander";
import {
  createPaperDraft,
  type PaperVenueTemplateId,
} from "../../packages/deepscholar-contracts/src/index.ts";
import type { ResearchProject } from "../../packages/deepscholar-contracts/src/index.ts";
import type { PeerReview } from "../../packages/deepscholar-contracts/src/index.ts";
import {
  recordDraftWritten,
  recordPeerReviewDecision,
  recordResultsVerified,
  type OrchestratorDeps,
} from "../../services/orchestrator/src/index.js";
import { aggregateReviews } from "../../services/review/src/index.js";
import {
  compilePaperDraft,
  createDockerLatexCompiler,
  createNodeCommandExecutor,
  writePaperBundle,
  type LatexCompiler,
} from "../../services/writing/src/index.js";
import { defaultRuntime, type RuntimeEnv } from "../runtime.js";
import { runCommandWithRuntime } from "./cli-utils.js";
import {
  createOrchestratorDeps,
  parseNonEmptyText,
  printJsonOrSummary,
  readJson,
  type CliRuntime,
} from "./research-orchestrator-helpers.js";

const DEFAULT_VENUE: PaperVenueTemplateId = "arxiv";
const DEFAULT_BIB_YEAR = String(new Date().getFullYear());
const DEFAULT_TEX_IMAGE = "texlive/texlive";
const DEFAULT_TIMEOUT_SECONDS = 120;

type Phase4CliRuntime = Pick<RuntimeEnv, "log" | "error" | "exit">;

export type Phase4CliDeps = {
  readonly orchestrator: OrchestratorDeps;
  readonly createLatexCompiler: (image: string) => LatexCompiler;
};

export type Phase4CliDepsFactory = (homeDir?: string) => Phase4CliDeps;

const createDefaultDeps: Phase4CliDepsFactory = (homeDir?: string) => {
  const exec = createNodeCommandExecutor();
  return {
    orchestrator: createOrchestratorDeps(homeDir),
    createLatexCompiler: (image: string) => createDockerLatexCompiler({ exec, image }),
  };
};

function parsePositiveInt(raw: unknown, label: string, fallback: number): number {
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(`${label} 必须是正整数`);
  }
  return n;
}

function requireStep(project: ResearchProject, step: ResearchProject["step"]): void {
  if (project.step !== step) {
    throw new Error(`当前步骤不是 ${step}，不能执行该操作: step=${project.step}`);
  }
}

export function registerResearchPhase4Cli(
  research: Command,
  runtime: CliRuntime = defaultRuntime,
  depsFactory: Phase4CliDepsFactory = createDefaultDeps,
): void {
  registerResultsValidate(research, runtime, depsFactory);
  registerPaperCli(research, runtime, depsFactory);
  registerReviewCli(research, runtime, depsFactory);
}

function registerResultsValidate(
  research: Command,
  runtime: Phase4CliRuntime,
  depsFactory: Phase4CliDepsFactory,
): void {
  research
    .command("validate")
    .description("Mark Step9 results verified and advance to Step10 paper writing")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--summary <text>", "Validation summary (human/auditor)")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--actor-id <id>", "Audit actor id (human)", "human")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runResultsValidate(opts, runtime, depsFactory));
    });
}

async function runResultsValidate(
  opts: Record<string, unknown>,
  runtime: Phase4CliRuntime,
  depsFactory: Phase4CliDepsFactory,
): Promise<void> {
  const deps = depsFactory(opts.home as string | undefined);
  const project = await recordResultsVerified(deps.orchestrator, {
    projectId: parseNonEmptyText(opts.projectId, "project-id"),
    summary: parseNonEmptyText(opts.summary, "summary"),
    actorId: parseNonEmptyText(opts.actorId, "actor-id", "human"),
  });

  printJsonOrSummary(
    opts,
    project,
    `结果已验证 | 项目 ${project.projectId} | 进入步骤 ${project.step}`,
    runtime.log,
  );
}

function registerPaperCli(
  research: Command,
  runtime: Phase4CliRuntime,
  depsFactory: Phase4CliDepsFactory,
): void {
  const paper = research.command("paper").description("Paper bundle utilities (write/compile)");
  registerPaperWrite(paper, runtime, depsFactory);
  registerPaperCompile(paper, runtime, depsFactory);
}

function registerPaperWrite(
  paper: Command,
  runtime: Phase4CliRuntime,
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
  runtime: Phase4CliRuntime,
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
  runtime: Phase4CliRuntime,
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
  runtime: Phase4CliRuntime,
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

function registerReviewCli(
  research: Command,
  runtime: Phase4CliRuntime,
  depsFactory: Phase4CliDepsFactory,
): void {
  const review = research
    .command("review")
    .description("Peer review utilities (aggregate + writeback)");
  review
    .command("decide")
    .description("Aggregate 3 peer reviews and write the decision back to project state")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--draft-id <id>", "Draft id")
    .requiredOption("--reviews <path>", "JSON array file of PeerReview")
    .option("--decision-id <id>", "Decision id (default: generated)")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--actor-id <id>", "Audit actor id (human)", "human")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runReviewDecide(opts, runtime, depsFactory));
    });
}

async function runReviewDecide(
  opts: Record<string, unknown>,
  runtime: Phase4CliRuntime,
  depsFactory: Phase4CliDepsFactory,
): Promise<void> {
  const deps = depsFactory(opts.home as string | undefined);
  const projectId = parseNonEmptyText(opts.projectId, "project-id");
  const draftId = parseNonEmptyText(opts.draftId, "draft-id");
  const project = await deps.orchestrator.projects.load(projectId);
  requireStep(project, "step11_peer_review");

  const raw = await readJson<unknown>(parseNonEmptyText(opts.reviews, "reviews"));
  if (!Array.isArray(raw)) {
    throw new Error("reviews 必须是 JSON array");
  }
  const reviews = raw as PeerReview[];
  for (const review of reviews) {
    if (review.projectId !== projectId || review.draftId !== draftId) {
      throw new Error("PeerReview.projectId/draftId 必须与 CLI 参数一致");
    }
  }

  const decisionId =
    opts.decisionId === undefined || opts.decisionId === null || opts.decisionId === ""
      ? `dec-${crypto.randomUUID()}`
      : parseNonEmptyText(opts.decisionId, "decision-id");

  const aggregate = aggregateReviews(reviews, { decisionId });
  const next = await recordPeerReviewDecision(deps.orchestrator, {
    projectId,
    decision: aggregate.decision,
    actorId: parseNonEmptyText(opts.actorId, "actor-id", "human"),
  });

  const out = { decision: aggregate.decision, project: next };
  printJsonOrSummary(
    opts,
    out,
    `评审已裁决 | verdict=${aggregate.decision.verdict} | 项目步骤 ${next.step}`,
    runtime.log,
  );
}
