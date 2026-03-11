import type { Command } from "commander";
import { freezeProjectPlan } from "../../services/orchestrator/src/index.js";
import { runCommandWithRuntime } from "./cli-utils.js";
import type { CliRuntime } from "./research-orchestrator-helpers.js";
import {
  createOrchestratorDeps,
  parseNonEmptyText,
  printJsonOrSummary,
  readJson,
} from "./research-orchestrator-helpers.js";

type FreezePlanInput = Parameters<typeof freezeProjectPlan>[1];
type DraftPayload = FreezePlanInput["draft"];

export function registerResearchPlanCli(research: Command, runtime: CliRuntime): void {
  const plan = research.command("plan").description("Research plan utilities (freeze)");
  plan
    .command("freeze")
    .description("Freeze a research plan draft into an immutable plan")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--draft <path>", "JSON file path of ResearchPlanDraft")
    .requiredOption("--approved-by <id>", "Approver id (human)")
    .option("--approved-at <iso>", "Approval time ISO (default: now)")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--actor-id <id>", "Audit actor id", "human")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runResearchPlanFreeze(opts, runtime));
    });
}

async function runResearchPlanFreeze(
  opts: Record<string, unknown>,
  runtime: CliRuntime,
): Promise<void> {
  const projectId = parseNonEmptyText(opts.projectId, "project-id");
  const draftPath = parseNonEmptyText(opts.draft, "draft");
  const draft = (await readJson<unknown>(draftPath)) as DraftPayload;
  const approval = {
    approvedBy: parseNonEmptyText(opts.approvedBy, "approved-by"),
    approvedAt: parseNonEmptyText(opts.approvedAt, "approved-at", new Date().toISOString()),
  };
  const deps = createOrchestratorDeps(opts.home as string | undefined);
  const next = await freezeProjectPlan(deps, {
    projectId,
    draft,
    approval,
    actorId: parseNonEmptyText(opts.actorId, "actor-id", "human"),
  });

  printJsonOrSummary(
    opts,
    next,
    `已冻结研究计划 | 项目 ${next.projectId} | 进入步骤 ${next.step} | 状态 ${next.lifecycle}`,
    runtime.log,
  );
}
