import { pathToFileURL } from "node:url";
import type { ProjectCharter, ServiceDescriptor } from "@deepscholar/contracts";
import { createProjectCharter } from "@deepscholar/contracts";

export { advancePhase, canAdvancePhase, createInitialPhaseState } from "./phase-machine.ts";
export { evaluateBudgetGate, type BudgetDecision } from "./budget-gate.ts";

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
