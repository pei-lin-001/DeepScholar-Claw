import { pathToFileURL } from "node:url";
import type { ProjectCharter, ServiceDescriptor } from "@deepscholar/contracts";
import { createProjectCharter } from "@deepscholar/contracts";

export { advancePhase, canAdvancePhase, createInitialPhaseState } from "./phase-machine.ts";
export { evaluateBudgetGate, type BudgetDecision } from "./budget-gate.ts";
export { createTurnBus, type TurnBus, type TurnMessage } from "./turn-bus.ts";
export {
  FIXED_BOTS,
  getFixedBot,
  type FixedBotDefinition,
  type FixedBotId,
} from "./bots/fixed-bots.ts";
export {
  createInMemoryBotTemplateRegistry,
  type BotTemplate,
  type BotTemplateRegistry,
} from "./bots/template-registry.ts";
export {
  advanceStep,
  createEmptyGateContext,
  evaluateStepTransition,
  phaseForStep,
  type StepGateContext,
  type StepTransitionDecision,
} from "./step-machine.ts";
export { createFsAuditLogStore, type AuditLogStore } from "./audit-log-fs.ts";
export { createFsCheckpointStore, type CheckpointStore } from "./checkpoints-fs.ts";
export {
  createFsBudgetApprovalStore,
  type BudgetApprovalStore,
} from "./budget-approvals-store-fs.ts";
export { createFsProjectStore, type ProjectStore } from "./project-store-fs.ts";
export { createFsMemoryStore } from "./memory-store-fs.ts";
export {
  resolveDeepScholarHome,
  resolveProjectPaths,
  type DeepScholarHome,
  type ProjectPaths,
} from "./project-paths.ts";
export {
  abortProject,
  approveBudgetApproval,
  freezeProjectPlan,
  recordDraftWritten,
  recordExperimentRunResult,
  recordPeerReviewDecision,
  recordResultsVerified,
  rejectBudgetApproval,
  requestBudgetApproval,
  resumeProject,
  startProject,
  type OrchestratorDeps,
} from "./orchestrator-engine.ts";

export const orchestratorService: ServiceDescriptor = {
  id: "orchestrator",
  displayName: "Research Orchestrator",
  owns: ["project charter", "phase transitions", "approval gates", "task routing"],
  consumes: ["paper-intel evidence", "runner status", "provenance decisions"],
  produces: ["research plans", "execution requests", "human approval checkpoints"],
  outOfScope: ["full-text parsing", "gpu execution", "claim verification"],
};

export function createBootstrapCharter(title: string): ProjectCharter {
  return createProjectCharter({
    projectId: "deepscholar-bootstrap",
    title,
    scope: "第一阶段骨架开发",
    targetVenue: "internal",
    ownerRoles: ["科研总监", "财务大总管", "方向纠偏者"],
    budgetEnvelope: { totalUsd: 0, gpuUsd: 0, llmUsd: 0 },
    constraints: ["OpenClaw 仅作为控制面", "重逻辑全部外置服务"],
    nonGoals: ["真实实验执行", "真实学术 API 接入"],
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  console.log(JSON.stringify(orchestratorService, null, 2));
}
