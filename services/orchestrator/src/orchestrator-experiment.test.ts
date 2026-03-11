import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createExperimentRun,
  createResearchPlanDraft,
  createResearchProject,
  freezeResearchPlan,
} from "@deepscholar/contracts";
import { describe, expect, it } from "vitest";
import { createFsAuditLogStore } from "./audit-log-fs.ts";
import { createFsBudgetApprovalStore } from "./budget-approvals-store-fs.ts";
import { recordExperimentRunResult } from "./orchestrator-engine.ts";
import { createFsProjectStore } from "./project-store-fs.ts";
import { phaseForStep } from "./step-machine.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-orch-exp-"));
}

function createFrozenPlan(projectId: string, maxFailedAttempts: number) {
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
    stopRules: { maxFailedAttempts, budgetDepletionPercent: 80, timeLimitHours: 12 },
  });
  return freezeResearchPlan({
    draft,
    frozenAt: "2026-03-10T00:00:00.500Z",
    approval: { approvedBy: "human", approvedAt: "2026-03-10T00:00:00.600Z" },
  });
}

describe("orchestrator experiment bridge", () => {
  it("records a succeeded run and advances step8 -> step9", async () => {
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
      plan: createFrozenPlan("p1", 2),
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
      startedAt: "2026-03-10T00:00:01.100Z",
      finishedAt: "2026-03-10T00:00:01.900Z",
      exitCode: 0,
      artifacts: [],
    });

    const next = await recordExperimentRunResult(deps, { projectId: "p1", run, actorId: "human" });
    expect(next.latestRunId).toBe("run-1");
    expect(next.latestRunStatus).toBe("succeeded");
    expect(next.gates.experimentCompleted).toBe(true);
    expect(next.step).toBe("step9_result_validation");
    expect(next.phase).toBe(phaseForStep("step9_result_validation"));
    expect(next.failedAttemptCount).toBe(0);

    const entries = await deps.audit.list("p1");
    expect(entries.map((entry) => entry.action)).toContain("experiment.run");
  });

  it("trips circuit breaker when failure count reaches maxFailedAttempts", async () => {
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
      plan: createFrozenPlan("p1", 1),
      gates: { ...project.gates, hasFrozenPlan: true, budgetApproved: true },
    });

    const run = createExperimentRun({
      runId: "run-2",
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      status: "timeout",
      createdAt: "2026-03-10T00:00:01.000Z",
      updatedAt: "2026-03-10T00:00:03.000Z",
      artifacts: [],
    });

    const next = await recordExperimentRunResult(deps, { projectId: "p1", run, actorId: "human" });
    expect(next.latestRunId).toBe("run-2");
    expect(next.latestRunStatus).toBe("timeout");
    expect(next.gates.experimentCompleted).toBe(false);
    expect(next.step).toBe("step8_cloud_experiment");
    expect(next.failedAttemptCount).toBe(1);
    expect(next.lifecycle).toBe("paused");

    const entries = await deps.audit.list("p1");
    expect(entries.map((entry) => entry.action)).toContain("experiment.run.circuit_breaker");
  });

  it("only pauses after consecutive failures exceed the threshold", async () => {
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
      plan: createFrozenPlan("p1", 2),
      gates: { ...project.gates, hasFrozenPlan: true, budgetApproved: true },
    });

    const run1 = createExperimentRun({
      runId: "run-3",
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      status: "failed",
      createdAt: "2026-03-10T00:00:01.000Z",
      updatedAt: "2026-03-10T00:00:03.000Z",
      artifacts: [],
    });

    const afterFirst = await recordExperimentRunResult(deps, {
      projectId: "p1",
      run: run1,
      actorId: "human",
    });
    expect(afterFirst.failedAttemptCount).toBe(1);
    expect(afterFirst.lifecycle).toBe("active");

    const run2 = createExperimentRun({
      runId: "run-4",
      projectId: "p1",
      planId: "plan-1",
      experimentId: "exp-1",
      status: "timeout",
      createdAt: "2026-03-10T00:00:04.000Z",
      updatedAt: "2026-03-10T00:00:05.000Z",
      artifacts: [],
    });

    const afterSecond = await recordExperimentRunResult(deps, {
      projectId: "p1",
      run: run2,
      actorId: "human",
    });
    expect(afterSecond.failedAttemptCount).toBe(2);
    expect(afterSecond.lifecycle).toBe("paused");
  });
});
