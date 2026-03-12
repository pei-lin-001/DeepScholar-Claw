import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createExperimentRun,
  createResearchPlanDraft,
  createResearchProject,
  freezeResearchPlan,
  type ResearchProject,
  type ReviewDecision,
} from "@deepscholar/contracts";
import { describe, expect, it } from "vitest";
import { createFsAuditLogStore } from "./audit-log-fs.ts";
import { createFsBudgetApprovalStore } from "./budget-approvals-store-fs.ts";
import {
  completeProject,
  recordDraftWritten,
  recordExperimentRunResult,
  recordPeerReviewDecision,
  recordResultsVerified,
} from "./orchestrator-engine.ts";
import { createFsProjectStore } from "./project-store-fs.ts";
import { phaseForStep } from "./step-machine.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-orch-phase4-"));
}

function createFrozenPlan(projectId: string) {
  const draft = createResearchPlanDraft({
    planId: `${projectId}-plan`,
    projectId,
    hypothesis: "Works better",
    successCriteria: {
      primaryMetric: "accuracy",
      targetValue: 0.85,
      improvementOverBaseline: 0.05,
    },
    baselines: [
      {
        name: "baseline",
        source: "official",
        metricValues: { accuracy: 0.8 },
      },
    ],
    datasets: [{ name: "mnist", version: "1.0", split: "train" }],
    evaluationMetrics: ["accuracy"],
    budgetEnvelope: { maxGpuHours: 0, maxCostUsd: 0, maxExperiments: 1 },
    stopRules: { maxFailedAttempts: 1, budgetDepletionPercent: 80, timeLimitHours: 12 },
  });
  return freezeResearchPlan({
    draft,
    frozenAt: "2026-03-10T00:00:00.500Z",
    approval: { approvedBy: "human", approvedAt: "2026-03-10T00:00:00.600Z" },
  });
}

function acceptDecision(projectId: string, draftId: string): ReviewDecision {
  return {
    decisionId: "dec-accept",
    projectId,
    draftId,
    decidedAt: "2026-03-11T00:00:10.000Z",
    verdict: "accept",
    averageScore: 8,
    scoreSpread: 1,
    debateTriggered: false,
    summary: "accepted",
  };
}

function majorRevisionDecision(projectId: string, draftId: string): ReviewDecision {
  return {
    decisionId: "dec-major",
    projectId,
    draftId,
    decidedAt: "2026-03-11T00:00:10.000Z",
    verdict: "major_revision",
    averageScore: 4.5,
    scoreSpread: 1,
    debateTriggered: false,
    summary: "major revision",
  };
}

describe("orchestrator phase4 bridge", () => {
  it("advances step9 -> step10 -> step11 -> step12 when gates are written", async () => {
    const homeDir = await createTempDir();
    const deps = {
      projects: createFsProjectStore({ homeDir }),
      approvals: createFsBudgetApprovalStore({ homeDir }),
      audit: createFsAuditLogStore({ homeDir }),
    };

    const project = createResearchProject({
      projectId: "p1",
      title: "Demo",
      topic: "graph rag",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
      lifecycle: "active",
      phase: phaseForStep("step8_cloud_experiment"),
      step: "step8_cloud_experiment",
    });
    await deps.projects.init({
      ...project,
      plan: createFrozenPlan("p1"),
      gates: { ...project.gates, hasFrozenPlan: true, budgetApproved: true },
    });

    const run = createExperimentRun({
      runId: "run-1",
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      status: "succeeded",
      createdAt: "2026-03-10T00:00:01.000Z",
      updatedAt: "2026-03-10T00:00:02.000Z",
      artifacts: [],
    });
    const afterRun = await recordExperimentRunResult(deps, {
      projectId: "p1",
      run,
      actorId: "human",
    });
    expect(afterRun.step).toBe("step9_result_validation");

    const afterVerify = await recordResultsVerified(deps, {
      projectId: "p1",
      summary: "ok",
      actorId: "human",
    });
    expect(afterVerify.gates.resultsVerified).toBe(true);
    expect(afterVerify.step).toBe("step10_paper_writing");
    expect(afterVerify.phase).toBe(phaseForStep("step10_paper_writing"));

    const afterDraft = await recordDraftWritten(deps, {
      projectId: "p1",
      draftId: "draft-1",
      actorId: "human",
    });
    expect(afterDraft.gates.draftWritten).toBe(true);
    expect(afterDraft.step).toBe("step11_peer_review");
    expect(afterDraft.phase).toBe(phaseForStep("step11_peer_review"));

    const afterReview = await recordPeerReviewDecision(deps, {
      projectId: "p1",
      decision: acceptDecision("p1", "draft-1"),
      actorId: "human",
    });
    expect(afterReview.gates.reviewCompleted).toBe(true);
    expect(afterReview.step).toBe("step12_human_final");
    expect(afterReview.phase).toBe(phaseForStep("step12_human_final"));

    const completed = await completeProject(deps, {
      projectId: "p1",
      summary: "final ok",
      actorId: "human",
    });
    expect(completed.lifecycle).toBe("completed");
  });

  it("rolls back to step10 and resets draftWritten on major revision", async () => {
    const homeDir = await createTempDir();
    const deps = {
      projects: createFsProjectStore({ homeDir }),
      approvals: createFsBudgetApprovalStore({ homeDir }),
      audit: createFsAuditLogStore({ homeDir }),
    };

    const project: ResearchProject = createResearchProject({
      projectId: "p1",
      title: "Demo",
      topic: "graph rag",
      createdAt: "2026-03-10T00:00:00.000Z",
      updatedAt: "2026-03-10T00:00:00.000Z",
      lifecycle: "active",
      phase: phaseForStep("step11_peer_review"),
      step: "step11_peer_review",
    });
    await deps.projects.init({
      ...project,
      gates: { ...project.gates, resultsVerified: true, draftWritten: true },
    });

    const next = await recordPeerReviewDecision(deps, {
      projectId: "p1",
      decision: majorRevisionDecision("p1", "draft-1"),
      actorId: "human",
    });
    expect(next.step).toBe("step10_paper_writing");
    expect(next.phase).toBe(phaseForStep("step10_paper_writing"));
    expect(next.gates.draftWritten).toBe(false);
    expect(next.gates.reviewCompleted).toBe(false);
  });
});
