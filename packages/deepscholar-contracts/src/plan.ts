import { isNonEmptyText, pushIf, uniqueStrings, type ValidationIssue } from "./validation.ts";

export type BaselineSpec = {
  readonly name: string;
  readonly source: "official" | "reproduced" | "third-party";
  readonly notes?: string;
};

export type ResearchPlan = {
  readonly planId: string;
  readonly projectId: string;
  readonly hypothesis: string;
  readonly successMetric: string;
  readonly successThreshold: number;
  readonly baselines: readonly BaselineSpec[];
  readonly datasets: readonly string[];
  readonly stopRules: readonly string[];
};

export type ExperimentSpec = {
  readonly experimentId: string;
  readonly projectId: string;
  readonly planId: string;
  readonly summary: string;
  readonly runtimeProfile: "smoke" | "standard" | "extended";
  readonly datasets: readonly string[];
  readonly metrics: readonly string[];
  readonly requiredArtifacts: readonly string[];
};

export type CreateResearchPlanInput = {
  readonly planId: string;
  readonly projectId: string;
  readonly hypothesis: string;
  readonly successMetric: string;
  readonly successThreshold: number;
  readonly baselines?: readonly BaselineSpec[];
  readonly datasets?: readonly string[];
  readonly stopRules?: readonly string[];
};

export function createResearchPlan(input: CreateResearchPlanInput): ResearchPlan {
  return {
    planId: input.planId,
    projectId: input.projectId,
    hypothesis: input.hypothesis,
    successMetric: input.successMetric,
    successThreshold: input.successThreshold,
    baselines: input.baselines ?? [],
    datasets: uniqueStrings(input.datasets ?? []),
    stopRules: uniqueStrings(input.stopRules ?? []),
  };
}

export function validateResearchPlan(plan: ResearchPlan): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(plan.planId), "planId", "研究计划编号不能为空");
  pushIf(issues, !isNonEmptyText(plan.hypothesis), "hypothesis", "研究假设不能为空");
  pushIf(issues, !isNonEmptyText(plan.successMetric), "successMetric", "成功指标不能为空");
  pushIf(issues, plan.successThreshold <= 0, "successThreshold", "成功阈值必须大于 0");
  pushIf(issues, plan.baselines.length === 0, "baselines", "至少定义一个 baseline");
  pushIf(issues, plan.datasets.length === 0, "datasets", "至少定义一个数据集");
  pushIf(issues, plan.stopRules.length === 0, "stopRules", "至少定义一个停止规则");
  return issues;
}

export function createExperimentSpec(input: ExperimentSpec): ExperimentSpec {
  return {
    ...input,
    datasets: uniqueStrings(input.datasets),
    metrics: uniqueStrings(input.metrics),
    requiredArtifacts: uniqueStrings(input.requiredArtifacts),
  };
}

export function validateExperimentSpec(spec: ExperimentSpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(spec.experimentId), "experimentId", "实验编号不能为空");
  pushIf(issues, !isNonEmptyText(spec.projectId), "projectId", "项目编号不能为空");
  pushIf(issues, !isNonEmptyText(spec.planId), "planId", "计划编号不能为空");
  pushIf(issues, !isNonEmptyText(spec.summary), "summary", "实验摘要不能为空");
  pushIf(issues, spec.datasets.length === 0, "datasets", "实验必须绑定数据集");
  pushIf(issues, spec.metrics.length === 0, "metrics", "实验必须定义指标");
  return issues;
}
