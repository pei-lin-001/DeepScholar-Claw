import { isNonEmptyText, pushIf, type ValidationIssue } from "./validation.ts";

export type BudgetEnvelope = {
  readonly totalUsd: number;
  readonly gpuUsd: number;
  readonly llmUsd: number;
};

export type ProjectCharter = {
  readonly projectId: string;
  readonly title: string;
  readonly scope: string;
  readonly targetVenue: string;
  readonly ownerRoles: readonly string[];
  readonly budgetEnvelope: BudgetEnvelope;
  readonly constraints: readonly string[];
  readonly nonGoals: readonly string[];
};

export type CreateProjectCharterInput = {
  readonly projectId: string;
  readonly title: string;
  readonly scope: string;
  readonly targetVenue?: string;
  readonly ownerRoles?: readonly string[];
  readonly budgetEnvelope?: Partial<BudgetEnvelope>;
  readonly constraints?: readonly string[];
  readonly nonGoals?: readonly string[];
};

const DEFAULT_OWNER_ROLES = ["科研总监", "财务大总管", "方向纠偏者"] as const;

export function createBudgetEnvelope(input: Partial<BudgetEnvelope> = {}): BudgetEnvelope {
  return {
    totalUsd: input.totalUsd ?? 0,
    gpuUsd: input.gpuUsd ?? 0,
    llmUsd: input.llmUsd ?? 0,
  };
}

export function createProjectCharter(input: CreateProjectCharterInput): ProjectCharter {
  return {
    projectId: input.projectId,
    title: input.title,
    scope: input.scope,
    targetVenue: input.targetVenue ?? "internal",
    ownerRoles: input.ownerRoles ?? DEFAULT_OWNER_ROLES,
    budgetEnvelope: createBudgetEnvelope(input.budgetEnvelope),
    constraints: input.constraints ?? [],
    nonGoals: input.nonGoals ?? [],
  };
}

export function validateProjectCharter(charter: ProjectCharter): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(charter.projectId), "projectId", "项目编号不能为空");
  pushIf(issues, !isNonEmptyText(charter.title), "title", "项目标题不能为空");
  pushIf(issues, !isNonEmptyText(charter.scope), "scope", "项目范围不能为空");
  pushIf(issues, charter.ownerRoles.length === 0, "ownerRoles", "至少需要一个负责人角色");
  pushIf(
    issues,
    charter.budgetEnvelope.totalUsd < charter.budgetEnvelope.gpuUsd + charter.budgetEnvelope.llmUsd,
    "budgetEnvelope",
    "总预算不能小于 GPU 与 LLM 预算之和",
  );
  return issues;
}
