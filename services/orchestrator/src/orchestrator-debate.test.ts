import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  createResearchProject,
  type ResearchProject,
  type ReviewDecision,
} from "@deepscholar/contracts";
import { describe, expect, it } from "vitest";
import { createFsAuditLogStore } from "./audit-log-fs.ts";
import { createFsBudgetApprovalStore } from "./budget-approvals-store-fs.ts";
import {
  recordPeerReviewDecision,
  resolvePeerReviewDebate,
} from "./orchestrator-engine.ts";
import { createFsProjectStore } from "./project-store-fs.ts";
import { resolveDeepScholarHome, resolveProjectPaths } from "./project-paths.ts";
import { phaseForStep } from "./step-machine.ts";

async function createTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "deepscholar-orch-debate-"));
}

function createStep11Project(projectId: string): ResearchProject {
  return createResearchProject({
    projectId,
    title: "Debate Demo",
    topic: "graph rag",
    createdAt: "2026-03-10T00:00:00.000Z",
    updatedAt: "2026-03-10T00:00:00.000Z",
    lifecycle: "active",
    phase: phaseForStep("step11_peer_review"),
    step: "step11_peer_review",
  });
}

function createDebateDecision(projectId: string, draftId: string): ReviewDecision {
  return {
    decisionId: "dec-debate",
    projectId,
    draftId,
    decidedAt: "2026-03-11T00:00:10.000Z",
    verdict: "accept",
    averageScore: 7.8,
    scoreSpread: 6,
    debateTriggered: true,
    summary: "scores diverged and need explicit debate resolution",
  };
}

describe("orchestrator debate resolution", () => {
  it("holds project at step11 when debate is triggered, then advances after explicit resolve", async () => {
    const homeDir = await createTempDir();
    const deps = {
      projects: createFsProjectStore({ homeDir }),
      approvals: createFsBudgetApprovalStore({ homeDir }),
      audit: createFsAuditLogStore({ homeDir }),
    };

    const project = createStep11Project("p1");
    await deps.projects.init({
      ...project,
      gates: { ...project.gates, resultsVerified: true, draftWritten: true },
    });

    const held = await recordPeerReviewDecision(deps, {
      projectId: "p1",
      decision: createDebateDecision("p1", "draft-1"),
      actorId: "human",
    });
    expect(held.step).toBe("step11_peer_review");
    expect(held.lifecycle).toBe("paused");
    expect(held.gates.reviewCompleted).toBe(false);

    const resolved = await resolvePeerReviewDebate(deps, {
      projectId: "p1",
      verdict: "accept",
      summary: "chair reviewed the split opinions and approved final accept",
      draftId: "draft-1",
      actorId: "chair",
    });
    expect(resolved.step).toBe("step12_human_final");
    expect(resolved.phase).toBe(phaseForStep("step12_human_final"));
    expect(resolved.lifecycle).toBe("active");
    expect(resolved.gates.reviewCompleted).toBe(true);

    const auditEntries = await deps.audit.list("p1");
    expect(auditEntries.map((entry) => entry.action)).toEqual([
      "review.debate.triggered",
      "review.debate.resolve",
    ]);

    const paths = resolveProjectPaths(resolveDeepScholarHome(homeDir), "p1");
    const checkpointFiles = (await fs.readdir(paths.checkpointsDir))
      .filter((name) => name.endsWith(".json"))
      .toSorted();
    expect(checkpointFiles).toHaveLength(2);
    expect(checkpointFiles.some((name) => name.startsWith("review_debate_triggered_"))).toBe(
      true,
    );
    expect(checkpointFiles.some((name) => name.startsWith("debate_accept_"))).toBe(true);
  });

  it("routes a resolved debate back to step10 on major revision", async () => {
    const homeDir = await createTempDir();
    const deps = {
      projects: createFsProjectStore({ homeDir }),
      approvals: createFsBudgetApprovalStore({ homeDir }),
      audit: createFsAuditLogStore({ homeDir }),
    };

    const project = createStep11Project("p2");
    await deps.projects.init({
      ...project,
      lifecycle: "paused",
      gates: { ...project.gates, resultsVerified: true, draftWritten: true },
    });

    const next = await resolvePeerReviewDebate(deps, {
      projectId: "p2",
      verdict: "major_revision",
      summary: "debate concluded that the paper needs another drafting round",
      draftId: "draft-2",
      actorId: "chair",
    });
    expect(next.step).toBe("step10_paper_writing");
    expect(next.phase).toBe(phaseForStep("step10_paper_writing"));
    expect(next.gates.draftWritten).toBe(false);
    expect(next.gates.reviewCompleted).toBe(false);
    expect(next.lifecycle).toBe("active");
  });
});
