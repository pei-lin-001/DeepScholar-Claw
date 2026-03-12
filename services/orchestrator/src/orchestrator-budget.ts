import {
  nowIsoTimestamp,
  type BudgetApprovalRequest,
  type ResearchProject,
} from "@deepscholar/contracts";
import { evaluateBudgetGate } from "./budget-gate.ts";
import { checkpointAndSave, actor, type OrchestratorDeps } from "./orchestrator-internals.ts";
import { advanceStep, phaseForStep } from "./step-machine.ts";

function assertBudgetGateAllowsRequest(input: {
  readonly totalBudgetUsd: number;
  readonly consumedBudgetUsd: number;
  readonly estimatedCostUsd: number;
  readonly isHighRisk: boolean;
}): void {
  const decision = evaluateBudgetGate(
    { totalUsd: input.totalBudgetUsd, gpuUsd: 0, llmUsd: 0 },
    { totalUsd: input.consumedBudgetUsd, gpuUsd: 0, llmUsd: 0 },
    { totalUsd: input.estimatedCostUsd, gpuUsd: 0, llmUsd: 0, isHighRisk: input.isHighRisk },
  );
  if (decision.allowed) {
    return;
  }
  throw new Error(`预算门控拒绝: ${decision.reasons.join("; ")}`);
}

function buildProjectAfterBudgetRequest(
  project: ResearchProject,
  requestId: string,
): ResearchProject {
  const pending = [...project.pendingApprovalRequestIds, requestId];
  const step =
    project.step === "step6_experiment_design"
      ? advanceStep(project.step, "step7_resource_approval", project.gates)
      : project.step;
  return {
    ...project,
    updatedAt: nowIsoTimestamp(),
    lifecycle: "paused",
    pendingApprovalRequestIds: pending,
    step,
    phase: phaseForStep(step),
  };
}

export async function requestBudgetApproval(
  deps: OrchestratorDeps,
  input: {
    readonly projectId: string;
    readonly requestor: string;
    readonly purpose: string;
    readonly estimatedCostUsd: number;
    readonly estimatedDuration: string;
    readonly consumedBudgetUsd: number;
    readonly totalBudgetUsd: number;
    readonly isHighRisk: boolean;
    readonly alternatives: readonly string[];
  },
): Promise<{ project: ResearchProject; request: BudgetApprovalRequest }> {
  const project = await deps.projects.load(input.projectId);
  assertBudgetGateAllowsRequest({
    totalBudgetUsd: input.totalBudgetUsd,
    consumedBudgetUsd: input.consumedBudgetUsd,
    estimatedCostUsd: input.estimatedCostUsd,
    isHighRisk: input.isHighRisk,
  });

  const request = await deps.approvals.create({
    projectId: input.projectId,
    requestor: input.requestor,
    purpose: input.purpose,
    estimatedCostUsd: input.estimatedCostUsd,
    estimatedDuration: input.estimatedDuration,
    consumedBudgetUsd: input.consumedBudgetUsd,
    totalBudgetUsd: input.totalBudgetUsd,
    isHighRisk: input.isHighRisk,
    alternatives: input.alternatives,
  });

  const next = buildProjectAfterBudgetRequest(project, request.requestId);
  await checkpointAndSave({
    deps,
    project: next,
    checkpointLabel: "budget_request",
    auditAction: "budget.request",
    details: { input: request.purpose, output: request.requestId },
    auditActor: actor(request.requestor, "bot"),
  });
  return { project: next, request };
}

function removePending(project: ResearchProject, requestId: string): string[] {
  return project.pendingApprovalRequestIds.filter((id) => id !== requestId);
}

export async function approveBudgetApproval(
  deps: OrchestratorDeps,
  input: {
    readonly projectId: string;
    readonly requestId: string;
    readonly decidedBy: string;
    readonly comments?: string;
  },
): Promise<{ project: ResearchProject; request: BudgetApprovalRequest }> {
  const project = await deps.projects.load(input.projectId);
  const request = await deps.approvals.approve(
    input.projectId,
    input.requestId,
    input.decidedBy,
    input.comments,
  );
  const pending = removePending(project, input.requestId);
  const gates = { ...project.gates, budgetApproved: true };
  const step =
    project.step === "step7_resource_approval"
      ? advanceStep(project.step, "step8_cloud_experiment", gates)
      : project.step;
  const next: ResearchProject = {
    ...project,
    updatedAt: nowIsoTimestamp(),
    lifecycle: pending.length === 0 ? "active" : project.lifecycle,
    pendingApprovalRequestIds: pending,
    gates,
    step,
    phase: phaseForStep(step),
  };
  await checkpointAndSave({
    deps,
    project: next,
    checkpointLabel: "budget_approved",
    auditAction: "budget.approve",
    details: { input: request.requestId, output: "approved" },
    auditActor: actor(input.decidedBy, "human"),
  });
  return { project: next, request };
}

export async function rejectBudgetApproval(
  deps: OrchestratorDeps,
  input: {
    readonly projectId: string;
    readonly requestId: string;
    readonly decidedBy: string;
    readonly comments?: string;
  },
): Promise<{ project: ResearchProject; request: BudgetApprovalRequest }> {
  const project = await deps.projects.load(input.projectId);
  const request = await deps.approvals.reject(
    input.projectId,
    input.requestId,
    input.decidedBy,
    input.comments,
  );
  const pending = removePending(project, input.requestId);
  const next: ResearchProject = {
    ...project,
    updatedAt: nowIsoTimestamp(),
    lifecycle: "paused",
    pendingApprovalRequestIds: pending,
  };
  await checkpointAndSave({
    deps,
    project: next,
    checkpointLabel: "budget_rejected",
    auditAction: "budget.reject",
    details: { input: request.requestId, output: "rejected" },
    auditActor: actor(input.decidedBy, "human"),
  });
  return { project: next, request };
}
