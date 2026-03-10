import type { Command } from "commander";
import { requestBudgetApproval } from "../../services/orchestrator/src/index.js";
import { runCommandWithRuntime } from "./cli-utils.js";
import type { CliRuntime } from "./research-orchestrator-helpers.js";
import {
  DEFAULT_REQUESTOR,
  createOrchestratorDeps,
  parseFiniteNumber,
  parseNonEmptyText,
  printJsonOrSummary,
} from "./research-orchestrator-helpers.js";

export function registerResearchBudgetCli(research: Command, runtime: CliRuntime): void {
  const budget = research.command("budget").description("Budget approval workflow");
  budget
    .command("request")
    .description("Create a budget request and pause the project until approved")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--purpose <text>", "Purpose of the request (e.g. GPU)")
    .requiredOption("--cost-usd <n>", "Estimated cost (USD)")
    .requiredOption("--duration <text>", "Estimated duration (e.g. 2h)")
    .requiredOption("--total-usd <n>", "Total budget (USD)")
    .option("--consumed-usd <n>", "Consumed budget so far (USD)", "0")
    .option("--requestor <id>", "Requestor id (default: budget-bot)", DEFAULT_REQUESTOR)
    .option("--high-risk", "Mark as high risk", false)
    .option(
      "--alternative <text>",
      "Cheaper alternative option",
      (value: string, prev: string[]) => {
        return [...prev, value];
      },
      [] as string[],
    )
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runResearchBudgetRequest(opts));
    });
}

async function runResearchBudgetRequest(opts: Record<string, unknown>): Promise<void> {
  const projectId = parseNonEmptyText(opts.projectId, "project-id");
  const deps = createOrchestratorDeps(opts.home as string | undefined);
  const result = await requestBudgetApproval(deps, {
    projectId,
    requestor: parseNonEmptyText(opts.requestor, "requestor", DEFAULT_REQUESTOR),
    purpose: parseNonEmptyText(opts.purpose, "purpose"),
    estimatedCostUsd: parseFiniteNumber(opts.costUsd, "cost-usd"),
    estimatedDuration: parseNonEmptyText(opts.duration, "duration"),
    consumedBudgetUsd: parseFiniteNumber(opts.consumedUsd, "consumed-usd"),
    totalBudgetUsd: parseFiniteNumber(opts.totalUsd, "total-usd"),
    isHighRisk: Boolean(opts.highRisk),
    alternatives: (opts.alternative as string[] | undefined) ?? [],
  });

  printJsonOrSummary(
    opts,
    result,
    `已发起预算审批 ${result.request.requestId} | 项目状态 ${result.project.lifecycle} | 待批 ${result.project.pendingApprovalRequestIds.length}`,
  );
}
