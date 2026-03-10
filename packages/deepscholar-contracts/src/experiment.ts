import { isNonEmptyText, pushIf, uniqueStrings, type ValidationIssue } from "./validation.ts";

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

export type CreateExperimentSpecInput = {
  readonly experimentId: string;
  readonly projectId: string;
  readonly planId: string;
  readonly summary: string;
  readonly runtimeProfile: "smoke" | "standard" | "extended";
  readonly datasets: readonly string[];
  readonly metrics: readonly string[];
  readonly requiredArtifacts: readonly string[];
};

export function createExperimentSpec(input: CreateExperimentSpecInput): ExperimentSpec {
  return {
    experimentId: input.experimentId,
    projectId: input.projectId,
    planId: input.planId,
    summary: input.summary,
    runtimeProfile: input.runtimeProfile,
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
