import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createResearchPlanDraft } from "@deepscholar/contracts";
import { createResearchProject } from "@deepscholar/contracts";
import { describe, expect, it } from "vitest";
import { createFsAuditLogStore } from "./audit-log-fs.ts";
import { createFsBudgetApprovalStore } from "./budget-approvals-store-fs.ts";
import { freezeProjectPlan, requestBudgetApproval, startProject } from "./orchestrator-engine.ts";
import { createFsProjectStore } from "./project-store-fs.ts";
import { phaseForStep } from "./step-machine.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-orch-engine-"));
}

describe("orchestrator engine", () => {
  it("starts a new project and writes an audit entry", async () => {
    const homeDir = await createTempDir();
    const deps = {
      projects: createFsProjectStore({ homeDir }),
      approvals: createFsBudgetApprovalStore({ homeDir }),
      audit: createFsAuditLogStore({ homeDir }),
    };

    const created = await startProject(deps, {
      projectId: "p1",
      title: "Demo",
      topic: "graph rag",
      actorId: "human",
      createdAtIso: "2026-03-10T00:00:00.000Z",
    });

    expect(created.step).toBe("step0_plan_freeze");
    await expect(deps.projects.load("p1")).resolves.toMatchObject({ projectId: "p1" });
    const entries = await deps.audit.list("p1");
    expect(entries.map((entry) => entry.action)).toContain("project.start");
  });

  it("freezes a plan and advances step0 -> step1", async () => {
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
      phase: "plan",
      step: "step0_plan_freeze",
    });
    await deps.projects.init(project);

    const draft = createResearchPlanDraft({
      planId: "plan-1",
      projectId: "p1",
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

    const next = await freezeProjectPlan(deps, {
      projectId: "p1",
      draft,
      approval: { approvedBy: "human", approvedAt: "2026-03-10T00:00:01.000Z" },
    });

    expect(next.gates.hasFrozenPlan).toBe(true);
    expect(next.step).toBe("step1_literature_crawl");
    expect(next.phase).toBe(phaseForStep("step1_literature_crawl"));
  });

  it("records pending approvals and pauses project on budget request", async () => {
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
      phase: "plan",
      step: "step0_plan_freeze",
    });
    await deps.projects.init(project);

    const result = await requestBudgetApproval(deps, {
      projectId: "p1",
      requestor: "budget-bot",
      purpose: "GPU",
      estimatedCostUsd: 10,
      estimatedDuration: "2h",
      consumedBudgetUsd: 0,
      totalBudgetUsd: 100,
      isHighRisk: false,
      alternatives: [],
    });

    expect(result.project.lifecycle).toBe("paused");
    expect(result.project.pendingApprovalRequestIds).toEqual([result.request.requestId]);
  });
});
