import {
  createAuditEntry,
  createResearchProject,
  nowIsoTimestamp,
  type ResearchProject,
} from "@deepscholar/contracts";
import {
  checkpointAndSave,
  actor,
  isFileNotFoundError,
  type OrchestratorDeps,
} from "./orchestrator-internals.ts";

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
  return await checkpointAndSave({
    deps,
    project: next,
    checkpointLabel: "resume",
    auditAction: "project.resume",
    details: { input: "paused", output: "active" },
    auditActor: actor(input.actorId ?? "human", "human"),
  });
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
  return await checkpointAndSave({
    deps,
    project: next,
    checkpointLabel: "abort",
    auditAction: "project.abort",
    details: { input: input.reason, output: "aborted" },
    auditActor: actor(input.actorId ?? "human", "human"),
  });
}
