import type { Command } from "commander";
import { diagnoseRun } from "../../services/runner/src/index.js";
import { retryRun } from "../../services/runner/src/index.js";
import { runCommandWithRuntime } from "./cli-utils.js";
import {
  DEFAULT_COLLECT_TAIL_BYTES,
  parseNonEmptyText,
  parsePositiveInt,
  printJsonOrSummary,
  type RunnerCliDepsFactory,
  type RunnerCliRuntime,
} from "./research-runner-cli-helpers.js";

export function registerRunnerDiagnosticsCli(
  runner: Command,
  runtime: RunnerCliRuntime,
  depsFactory: RunnerCliDepsFactory,
): void {
  registerDiagnose(runner, runtime, depsFactory);
  registerRetry(runner, runtime, depsFactory);
}

function registerDiagnose(
  runner: Command,
  runtime: RunnerCliRuntime,
  depsFactory: RunnerCliDepsFactory,
): void {
  runner
    .command("diagnose")
    .description("Diagnose a run using log tails + metrics and suggest next action")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--run-id <id>", "Run id")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--tail-bytes <n>", "Tail bytes for stdout/stderr", String(DEFAULT_COLLECT_TAIL_BYTES))
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runDiagnose(opts, runtime, depsFactory));
    });
}

async function runDiagnose(
  opts: Record<string, unknown>,
  runtime: RunnerCliRuntime,
  depsFactory: RunnerCliDepsFactory,
): Promise<void> {
  const deps = depsFactory(opts.home as string | undefined);
  const projectId = parseNonEmptyText(opts.projectId, "project-id");
  const runId = parseNonEmptyText(opts.runId, "run-id");
  const tailBytes = parsePositiveInt(opts.tailBytes, "tail-bytes", DEFAULT_COLLECT_TAIL_BYTES);

  const diagnosis = await diagnoseRun({ store: deps.store, projectId, runId, tailBytes });
  if (opts.json) {
    runtime.log(JSON.stringify(diagnosis, null, 2));
    return;
  }
  runtime.log(`runId=${diagnosis.runId} status=${diagnosis.status}`);
  runtime.log(`rootCause=${diagnosis.rootCause}`);
  runtime.log(`suggestedFix=${diagnosis.suggestedFix}`);
  runtime.log(`policy=${JSON.stringify(diagnosis.policy)}`);
}

function registerRetry(
  runner: Command,
  runtime: RunnerCliRuntime,
  depsFactory: RunnerCliDepsFactory,
): void {
  runner
    .command("retry")
    .description(
      "Retry a failed/timeout/aborted run by cloning its executionRequest into a new run",
    )
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--run-id <id>", "Run id")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runRetry(opts, runtime, depsFactory));
    });
}

async function runRetry(
  opts: Record<string, unknown>,
  runtime: RunnerCliRuntime,
  depsFactory: RunnerCliDepsFactory,
): Promise<void> {
  const deps = depsFactory(opts.home as string | undefined);
  const projectId = parseNonEmptyText(opts.projectId, "project-id");
  const runId = parseNonEmptyText(opts.runId, "run-id");

  const run = await retryRun(deps.store, deps.docker, { projectId, runId });
  printJsonOrSummary(
    runtime,
    opts,
    run,
    `retry 完成: newRunId=${run.runId} status=${run.status} retryOf=${run.retryOfRunId ?? "(none)"}`,
  );
}
