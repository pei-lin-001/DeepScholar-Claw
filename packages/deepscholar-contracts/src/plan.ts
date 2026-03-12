import { isIsoTimestamp, type IsoTimestamp } from "./time.ts";
import {
  isFiniteNumber,
  isNonEmptyText,
  isNonNegativeNumber,
  isPositiveNumber,
  pushIf,
  uniqueStrings,
  type ValidationIssue,
} from "./validation.ts";

export type BaselineSource = "official" | "reproduced" | "third-party";
export type DatasetSplit = "train" | "val" | "test";

export type SuccessCriteria = {
  readonly primaryMetric: string;
  readonly targetValue: number;
  readonly improvementOverBaseline: number;
};

export type BaselineSpec = {
  readonly name: string;
  readonly source: BaselineSource;
  readonly metricValues: Readonly<Record<string, number>>;
  readonly notes?: string;
};

export type DatasetSpec = {
  readonly name: string;
  readonly version: string;
  readonly split: DatasetSplit;
};

export type ResearchBudgetEnvelope = {
  readonly maxGpuHours: number;
  readonly maxCostUsd: number;
  readonly maxExperiments: number;
};

export type StopRules = {
  readonly maxFailedAttempts: number;
  readonly budgetDepletionPercent: number;
  readonly timeLimitHours: number;
};

export type ResearchPlanDraft = {
  readonly planId: string;
  readonly projectId: string;
  readonly hypothesis: string;
  readonly successCriteria: SuccessCriteria;
  readonly baselines: readonly BaselineSpec[];
  readonly datasets: readonly DatasetSpec[];
  readonly evaluationMetrics: readonly string[];
  readonly budgetEnvelope: ResearchBudgetEnvelope;
  readonly stopRules: StopRules;
};

export type ResearchPlanApproval = {
  readonly approvedBy: string;
  readonly approvedAt: IsoTimestamp;
};

export type ResearchPlan = ResearchPlanDraft & {
  readonly frozenAt: IsoTimestamp;
  readonly approvedBy: string;
  readonly approvedAt: IsoTimestamp;
};

export type CreateResearchPlanDraftInput = {
  readonly planId: string;
  readonly projectId: string;
  readonly hypothesis: string;
  readonly successCriteria: SuccessCriteria;
  readonly baselines: readonly BaselineSpec[];
  readonly datasets: readonly DatasetSpec[];
  readonly evaluationMetrics: readonly string[];
  readonly budgetEnvelope: ResearchBudgetEnvelope;
  readonly stopRules: StopRules;
};

export type FreezeResearchPlanInput = {
  readonly draft: ResearchPlanDraft;
  readonly frozenAt: IsoTimestamp;
  readonly approval: ResearchPlanApproval;
};

function normalizeDatasetSpec(dataset: DatasetSpec): DatasetSpec {
  return {
    name: dataset.name.trim(),
    version: dataset.version.trim(),
    split: dataset.split,
  };
}

export function createResearchPlanDraft(input: CreateResearchPlanDraftInput): ResearchPlanDraft {
  return {
    planId: input.planId,
    projectId: input.projectId,
    hypothesis: input.hypothesis,
    successCriteria: input.successCriteria,
    baselines: input.baselines,
    datasets: input.datasets.map((dataset) => normalizeDatasetSpec(dataset)),
    evaluationMetrics: uniqueStrings(input.evaluationMetrics),
    budgetEnvelope: input.budgetEnvelope,
    stopRules: input.stopRules,
  };
}

export function freezeResearchPlan(input: FreezeResearchPlanInput): ResearchPlan {
  return {
    ...input.draft,
    frozenAt: input.frozenAt,
    approvedBy: input.approval.approvedBy,
    approvedAt: input.approval.approvedAt,
  };
}

function validateSuccessCriteria(criteria: SuccessCriteria): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(
    issues,
    !isNonEmptyText(criteria.primaryMetric),
    "successCriteria.primaryMetric",
    "主指标不能为空",
  );
  pushIf(
    issues,
    !isPositiveNumber(criteria.targetValue),
    "successCriteria.targetValue",
    "目标值必须为正数",
  );
  pushIf(
    issues,
    !isPositiveNumber(criteria.improvementOverBaseline),
    "successCriteria.improvementOverBaseline",
    "相对 baseline 的提升幅度必须为正数",
  );
  return issues;
}

function validateBaselineSpec(baseline: BaselineSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(baseline.name), "baselines.name", "baseline 名称不能为空");
  pushIf(
    issues,
    Object.keys(baseline.metricValues).length === 0,
    "baselines.metricValues",
    "baseline 至少要有一个指标值",
  );
  for (const [key, value] of Object.entries(baseline.metricValues)) {
    pushIf(issues, !isNonEmptyText(key), "baselines.metricValues", "baseline 指标名不能为空");
    pushIf(
      issues,
      !isFiniteNumber(value),
      "baselines.metricValues",
      "baseline 指标值必须是有限数字",
    );
  }
  return issues;
}

function validateDatasetSpec(dataset: DatasetSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(dataset.name), "datasets.name", "数据集名称不能为空");
  pushIf(issues, !isNonEmptyText(dataset.version), "datasets.version", "数据集版本不能为空");
  return issues;
}

function validateBudgetEnvelope(envelope: ResearchBudgetEnvelope): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(
    issues,
    !isNonNegativeNumber(envelope.maxGpuHours),
    "budgetEnvelope.maxGpuHours",
    "GPU 小时上限不能为负数",
  );
  pushIf(
    issues,
    !isNonNegativeNumber(envelope.maxCostUsd),
    "budgetEnvelope.maxCostUsd",
    "预算上限不能为负数",
  );
  pushIf(
    issues,
    envelope.maxExperiments < 1,
    "budgetEnvelope.maxExperiments",
    "最大实验次数至少为 1",
  );
  return issues;
}

function validateStopRules(rules: StopRules): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(
    issues,
    rules.maxFailedAttempts < 1,
    "stopRules.maxFailedAttempts",
    "最大失败次数至少为 1",
  );
  pushIf(
    issues,
    rules.budgetDepletionPercent <= 0 || rules.budgetDepletionPercent > 100,
    "stopRules.budgetDepletionPercent",
    "预算耗尽阈值必须在 (0, 100] 范围内",
  );
  pushIf(
    issues,
    !isPositiveNumber(rules.timeLimitHours),
    "stopRules.timeLimitHours",
    "时间上限必须为正数",
  );
  return issues;
}

export function validateResearchPlanDraft(draft: ResearchPlanDraft): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(draft.planId), "planId", "研究计划编号不能为空");
  pushIf(issues, !isNonEmptyText(draft.projectId), "projectId", "项目编号不能为空");
  pushIf(issues, !isNonEmptyText(draft.hypothesis), "hypothesis", "研究假设不能为空");
  issues.push(...validateSuccessCriteria(draft.successCriteria));

  pushIf(issues, draft.baselines.length === 0, "baselines", "至少定义一个 baseline");
  for (const baseline of draft.baselines) {
    issues.push(...validateBaselineSpec(baseline));
  }

  pushIf(issues, draft.datasets.length === 0, "datasets", "至少定义一个数据集");
  for (const dataset of draft.datasets) {
    issues.push(...validateDatasetSpec(dataset));
  }

  const metrics = uniqueStrings(draft.evaluationMetrics);
  pushIf(issues, metrics.length === 0, "evaluationMetrics", "至少定义一个评估指标");
  pushIf(
    issues,
    isNonEmptyText(draft.successCriteria.primaryMetric) &&
      !metrics.includes(draft.successCriteria.primaryMetric),
    "evaluationMetrics",
    "评估指标必须包含主指标(primaryMetric)",
  );
  issues.push(...validateBudgetEnvelope(draft.budgetEnvelope));
  issues.push(...validateStopRules(draft.stopRules));
  return issues;
}

export function validateResearchPlan(plan: ResearchPlan): ValidationIssue[] {
  const issues = validateResearchPlanDraft(plan);
  pushIf(issues, !isIsoTimestamp(plan.frozenAt), "frozenAt", "冻结时间必须是合法时间戳");
  pushIf(issues, !isNonEmptyText(plan.approvedBy), "approvedBy", "审批人不能为空");
  pushIf(issues, !isIsoTimestamp(plan.approvedAt), "approvedAt", "审批时间必须是合法时间戳");
  return issues;
}
