import type { Command } from "commander";
import { recordResultsVerified } from "../../services/orchestrator/src/index.js";
import { defaultRuntime } from "../runtime.js";
import { runCommandWithRuntime } from "./cli-utils.js";
import {
  parseNonEmptyText,
  printJsonOrSummary,
  type CliRuntime,
} from "./research-orchestrator-helpers.js";
import { createDefaultDeps, type Phase4CliDepsFactory } from "./research-phase4-shared.js";

export function registerResultsValidateCli(
  research: Command,
  runtime: CliRuntime = defaultRuntime,
  depsFactory: Phase4CliDepsFactory = createDefaultDeps,
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
  runtime: CliRuntime,
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
