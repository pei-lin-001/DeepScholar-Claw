import {
  createAuditEntry,
  createResearchProject,
  freezeResearchPlan,
  nowIsoTimestamp,
  validateResearchPlan,
  validateResearchPlanDraft,
  type AuditActor,
  type BudgetApprovalRequest,
  type ResearchPlanApproval,
  type ResearchPlanDraft,
  type ResearchProject,
} from "@deepscholar/contracts";
import type { AuditLogStore } from "./audit-log-fs.ts";
import type { BudgetApprovalStore } from "./budget-approvals-store-fs.ts";
import type { ProjectStore } from "./project-store-fs.ts";
import { advanceStep, phaseForStep } from "./step-machine.ts";

export type OrchestratorDeps = {
  readonly projects: ProjectStore;
  readonly approvals: BudgetApprovalStore;
  readonly audit: AuditLogStore;
};

function actor(id: string, type: AuditActor["actorType"]): AuditActor {
  return { actorId: id, actorType: type };
}

function isFileNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  return "code" in err && err.code === "ENOENT";
}

async function checkpointAndSave(
  deps: OrchestratorDeps,
  project: ResearchProject,
  label: string,
  auditAction: string,
  details: { input: string; output: string },
  auditActor: AuditActor,
): Promise<ResearchProject> {
  await deps.projects.save(project);
  await deps.projects.checkpoint(project, label);
  await deps.audit.append(
    project.projectId,
    createAuditEntry({
      timestamp: nowIsoTimestamp(),
      actor: auditActor,
      action: auditAction,
      phase: project.phase,
      step: project.step,
      details,
    }),
  );
  return project;
}

export async function startProject(
  deps: OrchestratorDeps,
  input: {
    readonly projectId: string;
    readonly title: string;
    readonly topic: string;
    readonly actorId?: string;
    readonly createdAtIso?: string;
  },
): Promise<ResearchProject> {
  try {
    await deps.projects.load(input.projectId);
    throw new Error(`项目已存在: ${input.projectId}`);
  } catch (err) {
    if (!isFileNotFoundError(err)) {
      throw err;
    }
  }

  const createdAt = input.createdAtIso ?? nowIsoTimestamp();
  const project = createResearchProject({
    projectId: input.projectId,
    title: input.title,
    topic: input.topic,
    createdAt,
    updatedAt: createdAt,
    lifecycle: "active",
    phase: "plan",
    step: "step0_plan_freeze",
  });

  await deps.projects.init(project);
  await deps.projects.checkpoint(project, "start");
  await deps.audit.append(
    input.projectId,
    createAuditEntry({
      timestamp: nowIsoTimestamp(),
      actor: actor(input.actorId ?? "human", "human"),
      action: "project.start",
      phase: project.phase,
      step: project.step,
      details: { input: input.topic, output: project.projectId },
    }),
  );
  return project;
}

export async function freezeProjectPlan(
  deps: OrchestratorDeps,
  input: {
    readonly projectId: string;
    readonly draft: ResearchPlanDraft;
    readonly frozenAtIso?: string;
    readonly approval: ResearchPlanApproval;
    readonly actorId?: string;
  },
): Promise<ResearchProject> {
  const project = await deps.projects.load(input.projectId);
  const draftIssues = validateResearchPlanDraft(input.draft);
  if (draftIssues.length > 0) {
    throw new Error(
      `研究计划草案校验失败: ${draftIssues.map((i) => `${i.field}:${i.message}`).join(", ")}`,
    );
  }
  const frozenAt = input.frozenAtIso ?? nowIsoTimestamp();
  const plan = freezeResearchPlan({
    draft: input.draft,
    frozenAt,
    approval: input.approval,
  });
  const issues = validateResearchPlan(plan);
  if (issues.length > 0) {
    throw new Error(
      `冻结后的研究计划校验失败: ${issues.map((i) => `${i.field}:${i.message}`).join(", ")}`,
    );
  }
  const next: ResearchProject = {
    ...project,
    updatedAt: nowIsoTimestamp(),
    plan,
    gates: { ...project.gates, hasFrozenPlan: true },
    step: advanceStep(project.step, "step1_literature_crawl", {
      ...project.gates,
      hasFrozenPlan: true,
    }),
    phase: phaseForStep("step1_literature_crawl"),
  };
  return await checkpointAndSave(
    deps,
    next,
    "plan_freeze",
    "research_plan.freeze",
    { input: "draft", output: "frozen" },
    actor(input.actorId ?? "human", "human"),
  );
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

  const pending = [...project.pendingApprovalRequestIds, request.requestId];
  const next: ResearchProject = {
    ...project,
    updatedAt: nowIsoTimestamp(),
    lifecycle: "paused",
    pendingApprovalRequestIds: pending,
    step:
      project.step === "step6_experiment_design"
        ? advanceStep(project.step, "step7_resource_approval", project.gates)
        : project.step,
    phase: phaseForStep(
      project.step === "step6_experiment_design" ? "step7_resource_approval" : project.step,
    ),
  };

  await checkpointAndSave(
    deps,
    next,
    "budget_request",
    "budget.request",
    { input: request.purpose, output: request.requestId },
    actor(request.requestor, "bot"),
  );
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
  await checkpointAndSave(
    deps,
    next,
    "budget_approved",
    "budget.approve",
    { input: request.requestId, output: "approved" },
    actor(input.decidedBy, "human"),
  );
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
  await checkpointAndSave(
    deps,
    next,
    "budget_rejected",
    "budget.reject",
    { input: request.requestId, output: "rejected" },
    actor(input.decidedBy, "human"),
  );
  return { project: next, request };
}

export async function resumeProject(
  deps: OrchestratorDeps,
  input: {
    readonly projectId: string;
    readonly actorId?: string;
  },
): Promise<ResearchProject> {
  const project = await deps.projects.load(input.projectId);
  if (project.pendingApprovalRequestIds.length > 0) {
    throw new Error("仍存在待审批请求，不能 resume");
  }
  const next: ResearchProject = { ...project, updatedAt: nowIsoTimestamp(), lifecycle: "active" };
  return await checkpointAndSave(
    deps,
    next,
    "resume",
    "project.resume",
    { input: "paused", output: "active" },
    actor(input.actorId ?? "human", "human"),
  );
}

export async function abortProject(
  deps: OrchestratorDeps,
  input: {
    readonly projectId: string;
    readonly reason: string;
    readonly actorId?: string;
  },
): Promise<ResearchProject> {
  const project = await deps.projects.load(input.projectId);
  const next: ResearchProject = { ...project, updatedAt: nowIsoTimestamp(), lifecycle: "aborted" };
  return await checkpointAndSave(
    deps,
    next,
    "abort",
    "project.abort",
    { input: input.reason, output: "aborted" },
    actor(input.actorId ?? "human", "human"),
  );
}
