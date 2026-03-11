import type { Command } from "commander";
import {
  createFsRunStore,
  createNodeDockerClient,
  type DockerClient,
  type RunStore,
} from "../../services/runner/src/index.js";
import { abortRun, runSmokeExperiment } from "../../services/runner/src/index.js";
import { defaultRuntime, type RuntimeEnv } from "../runtime.js";
import { runCommandWithRuntime } from "./cli-utils.js";

const DEFAULT_IMAGE = "alpine:3.20";
const DEFAULT_HOLD_SECONDS = 1;
const DEFAULT_TIMEOUT_SECONDS = 120;

type RunnerCliRuntime = Pick<RuntimeEnv, "log" | "error" | "exit">;

type RunnerCliDeps = {
  readonly store: RunStore;
  readonly docker: DockerClient;
};

type RunnerCliDepsFactory = (homeDir?: string) => RunnerCliDeps;

function parseNonEmptyText(raw: unknown, label: string, fallback?: string): string {
  if (raw === undefined || raw === null || raw === "") {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`${label} 不能为空`);
  }
  if (typeof raw !== "string") {
    throw new Error(`${label} 必须是字符串`);
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} 不能为空`);
  }
  return trimmed;
}

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

function printJsonOrSummary(
  runtime: RunnerCliRuntime,
  opts: Record<string, unknown>,
  value: unknown,
  summary: string,
): void {
  if (opts.json) {
    runtime.log(JSON.stringify(value, null, 2));
    return;
  }
  runtime.log(summary);
}

const createDefaultDeps: RunnerCliDepsFactory = (homeDir?: string) => {
  return {
    store: createFsRunStore({ homeDir }),
    docker: createNodeDockerClient(),
  };
};

export function registerResearchRunnerCli(
  research: Command,
  runtime: RunnerCliRuntime = defaultRuntime,
  depsFactory: RunnerCliDepsFactory = createDefaultDeps,
): void {
  const runner = research.command("runner").description("Local runner (Phase 3)");
  registerSmoke(runner, runtime, depsFactory);
  registerStatus(runner, runtime, depsFactory);
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
