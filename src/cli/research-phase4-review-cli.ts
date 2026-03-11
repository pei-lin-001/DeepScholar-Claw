import crypto from "node:crypto";
import type { Command } from "commander";
import type { PeerReview } from "../../packages/deepscholar-contracts/src/index.ts";
import { recordPeerReviewDecision } from "../../services/orchestrator/src/index.js";
import { aggregateReviews } from "../../services/review/src/index.js";
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
