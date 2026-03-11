import type { Command } from "commander";
import { collectRunSummary } from "../../services/runner/src/index.js";
import { diagnoseRun } from "../../services/runner/src/index.js";
import { retryRun } from "../../services/runner/src/index.js";
import { abortRun, runSmokeExperiment } from "../../services/runner/src/index.js";
import { runCommandWithRuntime } from "./cli-utils.js";
import {
  DEFAULT_COLLECT_TAIL_BYTES,
  DEFAULT_HOLD_SECONDS,
  DEFAULT_IMAGE,
  DEFAULT_SANDBOX_PROFILE,
  DEFAULT_TIMEOUT_SECONDS,
  createDefaultRunnerCliDeps,
  defaultRunnerCliRuntime,
  parseNonEmptyText,
  parsePositiveInt,
  parseSandboxProfile,
  printCollectedSummary,
  printJsonOrSummary,
  type RunnerCliDepsFactory,
  type RunnerCliRuntime,
} from "./research-runner-cli-helpers.js";

export function registerResearchRunnerCli(
  research: Command,
  runtime: RunnerCliRuntime = defaultRunnerCliRuntime,
  depsFactory: RunnerCliDepsFactory = createDefaultRunnerCliDeps,
): void {
  const runner = research.command("runner").description("Local runner (Phase 3)");
  registerSmoke(runner, runtime, depsFactory);
  registerStatus(runner, runtime, depsFactory);
  registerList(runner, runtime, depsFactory);
  registerCollect(runner, runtime, depsFactory);
  registerDiagnose(runner, runtime, depsFactory);
  registerRetry(runner, runtime, depsFactory);
  registerAbort(runner, runtime, depsFactory);
}

function registerSmoke(
  runner: Command,
  runtime: RunnerCliRuntime,
  depsFactory: RunnerCliDepsFactory,
): void {
  runner
    .command("smoke")
    .description(
      "Run a minimal smoke experiment inside Docker and store artifacts under ~/.deepscholar",
    )
    .requiredOption("--project-id <id>", "Project id")
    .option("--plan-id <id>", "Plan id (default: <projectId>-plan)")
    .option("--experiment-id <id>", "Experiment id (default: <projectId>-smoke)")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--image <name>", "Docker image", DEFAULT_IMAGE)
    .option(
      "--sandbox-profile <name>",
      "Docker sandbox profile: compat | hardened | gvisor",
      DEFAULT_SANDBOX_PROFILE,
    )
    .option(
      "--hold-seconds <n>",
      "Sleep seconds inside container (for abort demo)",
      String(DEFAULT_HOLD_SECONDS),
    )
    .option("--timeout-seconds <n>", "Hard timeout seconds", String(DEFAULT_TIMEOUT_SECONDS))
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runSmoke(opts, runtime, depsFactory));
    });
}

async function runSmoke(
  opts: Record<string, unknown>,
  runtime: RunnerCliRuntime,
  depsFactory: RunnerCliDepsFactory,
): Promise<void> {
  const projectId = parseNonEmptyText(opts.projectId, "project-id");
  const planId = parseNonEmptyText(opts.planId, "plan-id", `${projectId}-plan`);
  const experimentId = parseNonEmptyText(opts.experimentId, "experiment-id", `${projectId}-smoke`);
  const holdSeconds = parsePositiveInt(opts.holdSeconds, "hold-seconds", DEFAULT_HOLD_SECONDS);
  const timeoutSeconds = parsePositiveInt(
    opts.timeoutSeconds,
    "timeout-seconds",
    DEFAULT_TIMEOUT_SECONDS,
  );
  const deps = depsFactory(opts.home as string | undefined);
  const run = await runSmokeExperiment(deps.store, deps.docker, {
    projectId,
    planId,
    experimentId,
    image: parseNonEmptyText(opts.image, "image", DEFAULT_IMAGE),
    sandboxProfile: parseSandboxProfile(opts.sandboxProfile),
    holdSeconds,
    timeoutMs: timeoutSeconds * 1000,
  });

  printJsonOrSummary(
    runtime,
    opts,
    run,
    `smoke run 完成: runId=${run.runId} status=${run.status} (项目 ${run.projectId})`,
  );
}

function registerStatus(
  runner: Command,
  runtime: RunnerCliRuntime,
  depsFactory: RunnerCliDepsFactory,
): void {
  runner
    .command("status")
    .description("Show a run status snapshot (run.json)")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--run-id <id>", "Run id")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runStatus(opts, runtime, depsFactory));
    });
}

async function runStatus(
  opts: Record<string, unknown>,
  runtime: RunnerCliRuntime,
  depsFactory: RunnerCliDepsFactory,
): Promise<void> {
  const deps = depsFactory(opts.home as string | undefined);
  const run = await deps.store.load(
    parseNonEmptyText(opts.projectId, "project-id"),
    parseNonEmptyText(opts.runId, "run-id"),
  );
  printJsonOrSummary(runtime, opts, run, `runId=${run.runId} status=${run.status}`);
}

function registerList(
  runner: Command,
  runtime: RunnerCliRuntime,
  depsFactory: RunnerCliDepsFactory,
): void {
  runner
    .command("list")
    .description("List runs for a project (most recent first)")
    .requiredOption("--project-id <id>", "Project id")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runList(opts, runtime, depsFactory));
    });
}

async function runList(
  opts: Record<string, unknown>,
  runtime: RunnerCliRuntime,
  depsFactory: RunnerCliDepsFactory,
): Promise<void> {
  const deps = depsFactory(opts.home as string | undefined);
  const projectId = parseNonEmptyText(opts.projectId, "project-id");
  const runs = await deps.store.list(projectId);

  if (opts.json) {
    runtime.log(JSON.stringify(runs, null, 2));
    return;
  }
  if (runs.length === 0) {
    runtime.log(`项目 ${projectId} 暂无 runs`);
    return;
  }
  for (const run of runs) {
    runtime.log(`${run.runId} | ${run.status} | updatedAt=${run.updatedAt}`);
  }
}

function registerCollect(
  runner: Command,
  runtime: RunnerCliRuntime,
  depsFactory: RunnerCliDepsFactory,
): void {
  runner
    .command("collect")
    .description("Collect a run snapshot: status + metrics + log tails")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--run-id <id>", "Run id")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--tail-bytes <n>", "Tail bytes for stdout/stderr", String(DEFAULT_COLLECT_TAIL_BYTES))
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runCollect(opts, runtime, depsFactory));
    });
}

async function runCollect(
  opts: Record<string, unknown>,
  runtime: RunnerCliRuntime,
  depsFactory: RunnerCliDepsFactory,
): Promise<void> {
  const deps = depsFactory(opts.home as string | undefined);
  const projectId = parseNonEmptyText(opts.projectId, "project-id");
  const runId = parseNonEmptyText(opts.runId, "run-id");
  const tailBytes = parsePositiveInt(opts.tailBytes, "tail-bytes", DEFAULT_COLLECT_TAIL_BYTES);

  const summary = await collectRunSummary({ store: deps.store, projectId, runId, tailBytes });
  if (opts.json) {
    runtime.log(JSON.stringify(summary, null, 2));
    return;
  }
  printCollectedSummary(runtime, summary);
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

function registerAbort(
  runner: Command,
  runtime: RunnerCliRuntime,
  depsFactory: RunnerCliDepsFactory,
): void {
  runner
    .command("abort")
    .description("Abort a running run by stopping its Docker container")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--run-id <id>", "Run id")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runAbort(opts, runtime, depsFactory));
    });
}

async function runAbort(
  opts: Record<string, unknown>,
  runtime: RunnerCliRuntime,
  depsFactory: RunnerCliDepsFactory,
): Promise<void> {
  const deps = depsFactory(opts.home as string | undefined);
  const run = await abortRun(deps.store, deps.docker, {
    projectId: parseNonEmptyText(opts.projectId, "project-id"),
    runId: parseNonEmptyText(opts.runId, "run-id"),
  });
  printJsonOrSummary(runtime, opts, run, `已终止 runId=${run.runId} status=${run.status}`);
}
