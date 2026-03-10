import type { ResearchPhase } from "./phases.ts";
import type { ResearchStep } from "./steps.ts";
import { isIsoTimestamp, type IsoTimestamp } from "./time.ts";
import { isNonEmptyText, pushIf, type ValidationIssue } from "./validation.ts";

export type AuditActor = {
  readonly actorId: string;
  readonly actorType: "bot" | "human" | "system";
};

export type AuditDetails = {
  readonly input: string;
  readonly output: string;
  readonly modelUsed?: string;
  readonly tokenCount?: number;
  readonly costUsd?: number;
  readonly durationSeconds?: number;
};

export type AuditEntry = {
  readonly timestamp: IsoTimestamp;
  readonly actor: AuditActor;
  readonly action: string;
  readonly phase: ResearchPhase;
  readonly step: ResearchStep;
  readonly details: AuditDetails;
};

export function validateAuditEntry(entry: AuditEntry): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isIsoTimestamp(entry.timestamp), "timestamp", "审计时间必须是合法时间戳");
  pushIf(issues, !isNonEmptyText(entry.actor.actorId), "actor.actorId", "actorId 不能为空");
  pushIf(issues, !isNonEmptyText(entry.action), "action", "action 不能为空");
  pushIf(issues, !isNonEmptyText(entry.details.input), "details.input", "input 不能为空");
  pushIf(issues, !isNonEmptyText(entry.details.output), "details.output", "output 不能为空");

  if (entry.details.tokenCount !== undefined) {
    pushIf(issues, entry.details.tokenCount < 0, "details.tokenCount", "tokenCount 不能为负数");
  }
  if (entry.details.costUsd !== undefined) {
    pushIf(issues, entry.details.costUsd < 0, "details.costUsd", "costUsd 不能为负数");
  }
  if (entry.details.durationSeconds !== undefined) {
    pushIf(
      issues,
      entry.details.durationSeconds < 0,
      "details.durationSeconds",
      "durationSeconds 不能为负数",
    );
  }
  return issues;
}

export function createAuditEntry(input: {
  readonly timestamp: IsoTimestamp;
  readonly actor: AuditActor;
  readonly action: string;
  readonly phase: ResearchPhase;
  readonly step: ResearchStep;
  readonly details: AuditDetails;
}): AuditEntry {
  return {
    timestamp: input.timestamp,
    actor: input.actor,
    action: input.action,
    phase: input.phase,
    step: input.step,
    details: input.details,
  };
}
