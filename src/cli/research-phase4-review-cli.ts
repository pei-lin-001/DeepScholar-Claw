import crypto from "node:crypto";
import type { Command } from "commander";
import {
  REVIEW_VERDICTS,
  type PeerReview,
  type ReviewVerdict,
} from "../../packages/deepscholar-contracts/src/index.ts";
import {
  recordPeerReviewDecision,
  resolvePeerReviewDebate,
} from "../../services/orchestrator/src/index.js";
import { aggregateReviews, createFsReviewArchiveStore } from "../../services/review/src/index.js";
import { defaultRuntime } from "../runtime.js";
import { runCommandWithRuntime } from "./cli-utils.js";
import {
  parseNonEmptyText,
  printJsonOrSummary,
  readJson,
  type CliRuntime,
} from "./research-orchestrator-helpers.js";
import {
  createDefaultDeps,
  requireStep,
  type Phase4CliDepsFactory,
} from "./research-phase4-shared.js";

export function registerReviewCli(
  research: Command,
  runtime: CliRuntime = defaultRuntime,
  depsFactory: Phase4CliDepsFactory = createDefaultDeps,
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
  review
    .command("debate-resolve")
    .description("Resolve a disputed peer-review round and move the project forward explicitly")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--verdict <verdict>", `Final verdict: ${REVIEW_VERDICTS.join("/")}`)
    .requiredOption("--summary <text>", "Human-readable debate resolution summary")
    .option("--draft-id <id>", "Draft id for audit context")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--actor-id <id>", "Audit actor id (human)", "human")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () =>
        runReviewDebateResolve(opts, runtime, depsFactory),
      );
    });
}

async function runReviewDecide(
  opts: Record<string, unknown>,
  runtime: CliRuntime,
  depsFactory: Phase4CliDepsFactory,
): Promise<void> {
  const deps = depsFactory(opts.home as string | undefined);
  const projectId = parseNonEmptyText(opts.projectId, "project-id");
  const draftId = parseNonEmptyText(opts.draftId, "draft-id");
  const project = await deps.orchestrator.projects.load(projectId);
  requireStep(project, "step11_peer_review");
  const reviews = await loadPeerReviewsForDraft(opts, projectId, draftId);
  const decision = aggregateReviews(reviews, { decisionId: resolveDecisionId(opts) }).decision;

  const next = await recordPeerReviewDecision(deps.orchestrator, {
    projectId,
    decision,
    actorId: parseNonEmptyText(opts.actorId, "actor-id", "human"),
  });
  const archived = await archiveAppliedReviewRound({
    homeDir: opts.home as string | undefined,
    projectId,
    draftId,
    reviews,
    decision,
    project: next,
  });
  const out = {
    decision,
    project: next,
    reviewArchive: {
      roundId: archived.round.roundId,
      roundDir: archived.paths.roundDir,
      metaReviewPath: archived.paths.metaReviewPath,
      reviewerPaths: archived.reviewerPaths,
    },
  };
  printJsonOrSummary(
    opts,
    out,
    `评审已裁决 | round=${archived.round.roundId} | verdict=${decision.verdict} | 项目步骤 ${next.step}`,
    runtime.log,
  );
}

async function runReviewDebateResolve(
  opts: Record<string, unknown>,
  runtime: CliRuntime,
  depsFactory: Phase4CliDepsFactory,
): Promise<void> {
  const deps = depsFactory(opts.home as string | undefined);
  const projectId = parseNonEmptyText(opts.projectId, "project-id");
  const project = await deps.orchestrator.projects.load(projectId);
  requireStep(project, "step11_peer_review");

  const verdict = parseReviewVerdict(opts.verdict);
  const next = await resolvePeerReviewDebate(deps.orchestrator, {
    projectId,
    verdict,
    summary: parseNonEmptyText(opts.summary, "summary"),
    draftId: parseOptionalNonEmptyText(opts.draftId, "draft-id"),
    actorId: parseNonEmptyText(opts.actorId, "actor-id", "human"),
  });

  printJsonOrSummary(
    opts,
    next,
    `分歧已落槌 | verdict=${verdict} | 项目步骤 ${next.step} | 状态 ${next.lifecycle}`,
    runtime.log,
  );
}

function parseReviewVerdict(value: unknown): ReviewVerdict {
  const verdict = parseNonEmptyText(value, "verdict");
  if ((REVIEW_VERDICTS as readonly string[]).includes(verdict)) {
    return verdict as ReviewVerdict;
  }
  throw new Error(`verdict 必须是 ${REVIEW_VERDICTS.join("/")}`);
}

function parseOptionalNonEmptyText(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return parseNonEmptyText(value, field);
}

function resolveDecisionId(opts: Record<string, unknown>): string {
  const value = opts.decisionId;
  if (value === undefined || value === null || value === "") {
    return `dec-${crypto.randomUUID()}`;
  }
  return parseNonEmptyText(value, "decision-id");
}

async function loadPeerReviewsForDraft(
  opts: Record<string, unknown>,
  projectId: string,
  draftId: string,
): Promise<readonly PeerReview[]> {
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
  return reviews;
}

async function archiveAppliedReviewRound(input: {
  readonly homeDir?: string;
  readonly projectId: string;
  readonly draftId: string;
  readonly reviews: readonly PeerReview[];
  readonly decision: ReturnType<typeof aggregateReviews>["decision"];
  readonly project: Awaited<ReturnType<typeof recordPeerReviewDecision>>;
}) {
  const archiveStore = createFsReviewArchiveStore({ homeDir: input.homeDir });
  const stored = await archiveStore.archiveRound({
    projectId: input.projectId,
    draftId: input.draftId,
    reviews: input.reviews,
    decision: input.decision,
  });
  return await archiveStore.markRoundApplied(
    input.projectId,
    stored.round.roundId,
    input.project,
  );
}
