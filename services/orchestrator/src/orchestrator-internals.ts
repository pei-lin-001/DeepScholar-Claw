import {
  createAuditEntry,
  nowIsoTimestamp,
  type AuditActor,
  type ResearchProject,
} from "@deepscholar/contracts";
import type { AuditLogStore } from "./audit-log-fs.ts";
import type { BudgetApprovalStore } from "./budget-approvals-store-fs.ts";
import type { ProjectStore } from "./project-store-fs.ts";

export type OrchestratorDeps = {
  readonly projects: ProjectStore;
  readonly approvals: BudgetApprovalStore;
  readonly audit: AuditLogStore;
};

export function actor(id: string, type: AuditActor["actorType"]): AuditActor {
  return { actorId: id, actorType: type };
}

export function isFileNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== "object") {
    return false;
  }
  return "code" in err && err.code === "ENOENT";
}

export async function checkpointAndSave(params: {
  readonly deps: OrchestratorDeps;
  readonly project: ResearchProject;
  readonly checkpointLabel: string;
  readonly auditAction: string;
  readonly details: { input: string; output: string };
  readonly auditActor: AuditActor;
}): Promise<ResearchProject> {
  const { deps, project } = params;
  let previousProject: ResearchProject | null = null;
  try {
    previousProject = await deps.projects.load(project.projectId);
  } catch (err) {
    if (!isFileNotFoundError(err)) {
      throw err;
    }
  }

  await deps.projects.save(project);
  try {
    await deps.projects.checkpoint(project, params.checkpointLabel);
    await deps.audit.append(
      project.projectId,
      createAuditEntry({
        timestamp: nowIsoTimestamp(),
        actor: params.auditActor,
        action: params.auditAction,
        phase: project.phase,
        step: project.step,
        details: params.details,
      }),
    );
  } catch (err) {
    if (previousProject) {
      await deps.projects.save(previousProject);
    }
    throw new Error(`保存检查点或审计日志失败，已回滚项目状态: ${String(err)}`, { cause: err });
  }
  return project;
}
