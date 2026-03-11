import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createExperimentRun, createResearchProject } from "@deepscholar/contracts";
import { describe, expect, it } from "vitest";
import { createFsAuditLogStore } from "./audit-log-fs.ts";
import { createFsBudgetApprovalStore } from "./budget-approvals-store-fs.ts";
import { recordExperimentRunResult } from "./orchestrator-engine.ts";
import { createFsProjectStore } from "./project-store-fs.ts";
import { phaseForStep } from "./step-machine.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-orch-exp-"));
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
      gates: { ...project.gates, budgetApproved: true },
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

    const entries = await deps.audit.list("p1");
    expect(entries.map((entry) => entry.action)).toContain("experiment.run");
  });

  it("records a failed run but does not advance step", async () => {
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
      gates: { ...project.gates, budgetApproved: true },
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
  });
});
