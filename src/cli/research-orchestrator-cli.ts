import crypto from "node:crypto";
import type { Command } from "commander";
import {
  abortProject,
  approveBudgetApproval,
  rejectBudgetApproval,
  resumeProject,
  startProject,
} from "../../services/orchestrator/src/index.js";
import { defaultRuntime } from "../runtime.js";
import { runCommandWithRuntime } from "./cli-utils.js";
import { registerResearchBudgetCli } from "./research-orchestrator-budget-cli.js";
import type { CliRuntime } from "./research-orchestrator-helpers.js";
import {
  createOrchestratorDeps,
  parseNonEmptyText,
  printJsonOrSummary,
} from "./research-orchestrator-helpers.js";
import { registerResearchPlanCli } from "./research-orchestrator-plan-cli.js";

export function registerResearchOrchestratorCli(
  research: Command,
  runtime: CliRuntime = defaultRuntime,
) {
  registerResearchStart(research, runtime);
  registerResearchStatus(research, runtime);
  registerResearchPlanCli(research, runtime);
  registerResearchBudgetCli(research, runtime);
  registerResearchApprovals(research, runtime);
  registerResearchResume(research, runtime);
  registerResearchAbort(research, runtime);
}

function registerResearchStart(research: Command, runtime: CliRuntime): void {
  research
    .command("start")
    .description("Start a new DeepScholar research project (Phase 2 orchestration)")
    .requiredOption("--topic <text>", "Research topic")
    .option("--project-id <id>", "Project id (default: generated)")
    .option("--title <text>", "Project title (default: same as topic)")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--actor-id <id>", "Audit actor id", "human")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runResearchStart(opts));
    });
}

async function runResearchStart(opts: Record<string, unknown>): Promise<void> {
  const topic = parseNonEmptyText(opts.topic, "topic");
  const projectId =
    opts.projectId === undefined || opts.projectId === null || opts.projectId === ""
      ? `project-${crypto.randomUUID()}`
      : parseNonEmptyText(opts.projectId, "project-id");
  const title = parseNonEmptyText(opts.title, "title", topic);
  const deps = createOrchestratorDeps(opts.home as string | undefined);
  const project = await startProject(deps, {
    projectId,
    title,
    topic,
    actorId: parseNonEmptyText(opts.actorId, "actor-id", "human"),
  });

  printJsonOrSummary(
    opts,
    project,
    `已创建项目 ${project.projectId} | 当前步骤 ${project.step} | 状态 ${project.lifecycle}`,
  );
}

function registerResearchStatus(research: Command, runtime: CliRuntime): void {
  research
    .command("status")
    .description("Show a project status snapshot (phase/step/gates/approvals)")
    .requiredOption("--project-id <id>", "Project id")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runResearchStatus(opts));
    });
}

async function runResearchStatus(opts: Record<string, unknown>): Promise<void> {
  const projectId = parseNonEmptyText(opts.projectId, "project-id");
  const deps = createOrchestratorDeps(opts.home as string | undefined);
  const project = await deps.projects.load(projectId);
  const pending = await deps.approvals.list(projectId, "pending");

  const snapshot = {
    project,
    pendingApprovals: pending,
  };

  printJsonOrSummary(
    opts,
    snapshot,
    `项目 ${project.projectId} | 阶段 ${project.phase} | 步骤 ${project.step} | 状态 ${project.lifecycle} | 待批 ${pending.length}`,
  );
}

function registerResearchApprovals(research: Command, runtime: CliRuntime): void {
  research
    .command("approve")
    .description("Approve a pending budget request")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--request-id <id>", "Budget request id")
    .requiredOption("--decided-by <id>", "Approver id (human)")
    .option("--comments <text>", "Approval comments")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runResearchApprove(opts));
    });

  research
    .command("reject")
    .description("Reject a pending budget request")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--request-id <id>", "Budget request id")
    .requiredOption("--decided-by <id>", "Approver id (human)")
    .option("--comments <text>", "Rejection comments")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runResearchReject(opts));
    });
}

async function runResearchApprove(opts: Record<string, unknown>): Promise<void> {
  const deps = createOrchestratorDeps(opts.home as string | undefined);
  const result = await approveBudgetApproval(deps, {
    projectId: parseNonEmptyText(opts.projectId, "project-id"),
    requestId: parseNonEmptyText(opts.requestId, "request-id"),
    decidedBy: parseNonEmptyText(opts.decidedBy, "decided-by"),
    comments: opts.comments ? parseNonEmptyText(opts.comments, "comments") : undefined,
  });

  printJsonOrSummary(
    opts,
    result,
    `已批准 ${result.request.requestId} | 项目状态 ${result.project.lifecycle} | 当前步骤 ${result.project.step}`,
  );
}

async function runResearchReject(opts: Record<string, unknown>): Promise<void> {
  const deps = createOrchestratorDeps(opts.home as string | undefined);
  const result = await rejectBudgetApproval(deps, {
    projectId: parseNonEmptyText(opts.projectId, "project-id"),
    requestId: parseNonEmptyText(opts.requestId, "request-id"),
    decidedBy: parseNonEmptyText(opts.decidedBy, "decided-by"),
    comments: opts.comments ? parseNonEmptyText(opts.comments, "comments") : undefined,
  });

  printJsonOrSummary(
    opts,
    result,
    `已拒绝 ${result.request.requestId} | 项目状态 ${result.project.lifecycle} | 待批 ${result.project.pendingApprovalRequestIds.length}`,
  );
}

function registerResearchResume(research: Command, runtime: CliRuntime): void {
  research
    .command("resume")
    .description("Resume a paused project (requires no pending approvals)")
    .requiredOption("--project-id <id>", "Project id")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--actor-id <id>", "Audit actor id", "human")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runResearchResume(opts));
    });
}

async function runResearchResume(opts: Record<string, unknown>): Promise<void> {
  const deps = createOrchestratorDeps(opts.home as string | undefined);
  const project = await resumeProject(deps, {
    projectId: parseNonEmptyText(opts.projectId, "project-id"),
    actorId: parseNonEmptyText(opts.actorId, "actor-id", "human"),
  });

  printJsonOrSummary(
    opts,
    project,
    `已恢复项目 ${project.projectId} | 状态 ${project.lifecycle} | 当前步骤 ${project.step}`,
  );
}

function registerResearchAbort(research: Command, runtime: CliRuntime): void {
  research
    .command("abort")
    .description("Abort a project and write an audit trail entry")
    .requiredOption("--project-id <id>", "Project id")
    .requiredOption("--reason <text>", "Reason for aborting")
    .option("--home <dir>", "Override DeepScholar home directory (default: ~/.deepscholar)")
    .option("--actor-id <id>", "Audit actor id", "human")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runCommandWithRuntime(runtime, () => runResearchAbort(opts));
    });
}

async function runResearchAbort(opts: Record<string, unknown>): Promise<void> {
  const deps = createOrchestratorDeps(opts.home as string | undefined);
  const project = await abortProject(deps, {
    projectId: parseNonEmptyText(opts.projectId, "project-id"),
    reason: parseNonEmptyText(opts.reason, "reason"),
    actorId: parseNonEmptyText(opts.actorId, "actor-id", "human"),
  });

  printJsonOrSummary(opts, project, `已终止项目 ${project.projectId} | 状态 ${project.lifecycle}`);
}
