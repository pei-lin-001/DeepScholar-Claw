import type { Command } from "commander";
import { defaultRuntime } from "../runtime.js";
import type { CliRuntime } from "./research-orchestrator-helpers.js";
import { registerPaperCli } from "./research-phase4-paper-cli.js";
import { registerReviewCli } from "./research-phase4-review-cli.js";
import { createDefaultDeps, type Phase4CliDepsFactory } from "./research-phase4-shared.js";
import { registerResultsValidateCli } from "./research-phase4-validate-cli.js";

export type { Phase4CliDepsFactory } from "./research-phase4-shared.js";

export function registerResearchPhase4Cli(
  research: Command,
  runtime: CliRuntime = defaultRuntime,
  depsFactory: Phase4CliDepsFactory = createDefaultDeps,
): void {
  registerResultsValidateCli(research, runtime, depsFactory);
  registerPaperCli(research, runtime, depsFactory);
  registerReviewCli(research, runtime, depsFactory);
}
