import type { Command } from "commander";
import type {
  ExperimentRun,
  ResearchProject,
} from "../../packages/deepscholar-contracts/src/index.ts";
import {
  createFsAuditLogStore,
  createFsBudgetApprovalStore,
  createFsProjectStore,
  recordExperimentRunResult,
  type OrchestratorDeps,
} from "../../services/orchestrator/src/index.js";
import {
  createFsRunStore,
  createNodeDockerClient,
  DOCKER_SANDBOX_PROFILES,
  isDockerSandboxProfile,
  type DockerClient,
  type DockerSandboxProfile,
  type RunStore,
} from "../../services/runner/src/index.js";
import { runSmokeExperiment } from "../../services/runner/src/index.js";
import { defaultRuntime, type RuntimeEnv } from "../runtime.js";
import { runCommandWithRuntime } from "./cli-utils.js";

const DEFAULT_IMAGE = "alpine:3.20";
const DEFAULT_HOLD_SECONDS = 1;
const DEFAULT_TIMEOUT_SECONDS = 120;
const DEFAULT_SANDBOX_PROFILE = "compat";

type ExperimentCliRuntime = Pick<RuntimeEnv, "log" | "error" | "exit">;

type ExperimentCliDeps = {
  readonly orchestrator: OrchestratorDeps;
  readonly store: RunStore;
  readonly docker: DockerClient;
};

type ExperimentCliDepsFactory = (homeDir?: string) => ExperimentCliDeps;

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

function parseSandboxProfile(raw: unknown): DockerSandboxProfile {
  const value = parseNonEmptyText(raw, "sandbox-profile", DEFAULT_SANDBOX_PROFILE);
  if (isDockerSandboxProfile(value)) {
    return value;
  }
  throw new Error(`sandbox-profile 必须是 ${DOCKER_SANDBOX_PROFILES.join("/")}`);
}

function requireFrozenPlan(project: ResearchProject): string {
  if (!project.plan) {
    throw new Error("项目尚未冻结研究计划（plan 不存在），不能执行实验");
  }
  if (!project.gates.hasFrozenPlan) {
    throw new Error("研究计划尚未冻结（hasFrozenPlan=false），不能执行实验");
  }
  return project.plan.planId;
}

function requireStep8Ready(project: ResearchProject): void {
  if (project.step !== "step8_cloud_experiment") {
    throw new Error(`当前步骤不是 step8_cloud_experiment，不能执行实验: step=${project.step}`);
  }
  if (!project.gates.budgetApproved) {
    throw new Error("预算尚未审批通过（budgetApproved=false），不能执行实验");
  }
}

function printJsonOrSummary(
  runtime: ExperimentCliRuntime,
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

const createDefaultDeps: ExperimentCliDepsFactory = (homeDir?: string) => {
  return {
    orchestrator: {
      projects: createFsProjectStore({ homeDir }),
      approvals: createFsBudgetApprovalStore({ homeDir }),
      audit: createFsAuditLogStore({ homeDir }),
    },
    store: createFsRunStore({ homeDir }),
    docker: createNodeDockerClient(),
  };
};

export function registerResearchExperimentCli(
  research: Command,
  runtime: ExperimentCliRuntime = defaultRuntime,
  depsFactory: ExperimentCliDepsFactory = createDefaultDeps,
): void {
  const experiment = research.command("experiment").description("Experiment dispatch (Phase 3.4)");
  registerExperimentRun(experiment, runtime, depsFactory);
}

function registerExperimentRun(
  experiment: Command,
  runtime: ExperimentCliRuntime,
  depsFactory: ExperimentCliDepsFactory,
): void {
  experiment
    .command("run")
    .description("Run an approved experiment via Runner and write result back to project state")
    .requiredOption("--project-id <id>", "Project id")
    .option("--experiment-id <id>", "Experiment id (default: <projectId>-cloud-experiment)")
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
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--actor-id <id>", "Audit actor id (human)", "human")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runExperimentRun(opts, runtime, depsFactory));
    });
}

async function runExperimentRun(
  opts: Record<string, unknown>,
  runtime: ExperimentCliRuntime,
  depsFactory: ExperimentCliDepsFactory,
): Promise<void> {
  const deps = depsFactory(opts.home as string | undefined);
  const projectId = parseNonEmptyText(opts.projectId, "project-id");
  const project = await deps.orchestrator.projects.load(projectId);

  requireStep8Ready(project);
  const planId = requireFrozenPlan(project);

  const experimentId = parseNonEmptyText(
    opts.experimentId,
    "experiment-id",
    `${projectId}-cloud-experiment`,
  );
  const holdSeconds = parsePositiveInt(opts.holdSeconds, "hold-seconds", DEFAULT_HOLD_SECONDS);
  const timeoutSeconds = parsePositiveInt(
    opts.timeoutSeconds,
    "timeout-seconds",
    DEFAULT_TIMEOUT_SECONDS,
  );

  const run = await runSmokeExperiment(deps.store, deps.docker, {
    projectId,
    planId,
    experimentId,
    image: parseNonEmptyText(opts.image, "image", DEFAULT_IMAGE),
    sandboxProfile: parseSandboxProfile(opts.sandboxProfile),
    holdSeconds,
    timeoutMs: timeoutSeconds * 1000,
  });

  const next = await recordExperimentRunResult(deps.orchestrator, {
    projectId,
    run,
    actorId: parseNonEmptyText(opts.actorId, "actor-id", "human"),
  });

  const out: { readonly run: ExperimentRun; readonly project: ResearchProject } = {
    run,
    project: next,
  };

  printJsonOrSummary(
    runtime,
    opts,
    out,
    `实验已执行: runId=${run.runId} status=${run.status} | 项目步骤 ${next.step}`,
  );
}
