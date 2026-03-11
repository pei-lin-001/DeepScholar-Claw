import {
  freezeResearchPlan,
  nowIsoTimestamp,
  validateResearchPlan,
  validateResearchPlanDraft,
  type ResearchPlanApproval,
  type ResearchPlanDraft,
  type ResearchProject,
} from "@deepscholar/contracts";
import { checkpointAndSave, actor, type OrchestratorDeps } from "./orchestrator-internals.ts";
import { advanceStep, phaseForStep } from "./step-machine.ts";

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
  const plan = freezeResearchPlan({ draft: input.draft, frozenAt, approval: input.approval });
  const issues = validateResearchPlan(plan);
  if (issues.length > 0) {
    throw new Error(
      `冻结后的研究计划校验失败: ${issues.map((i) => `${i.field}:${i.message}`).join(", ")}`,
    );
  }

  const gates = { ...project.gates, hasFrozenPlan: true };
  const next: ResearchProject = {
    ...project,
    updatedAt: nowIsoTimestamp(),
    plan,
    gates,
    step: advanceStep(project.step, "step1_literature_crawl", gates),
    phase: phaseForStep("step1_literature_crawl"),
  };
  return await checkpointAndSave({
    deps,
    project: next,
    checkpointLabel: "plan_freeze",
    auditAction: "research_plan.freeze",
    details: { input: "draft", output: "frozen" },
    auditActor: actor(input.actorId ?? "human", "human"),
  });
}
