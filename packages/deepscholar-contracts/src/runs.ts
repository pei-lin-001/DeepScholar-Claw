import { isIsoTimestamp, type IsoTimestamp } from "./time.ts";
import { isNonEmptyText, isOneOf, pushIf, type ValidationIssue } from "./validation.ts";

export type ExperimentRunStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "aborted"
  | "timeout";

export const EXPERIMENT_RUN_STATUSES: readonly ExperimentRunStatus[] = [
  "queued",
  "running",
  "succeeded",
  "failed",
  "aborted",
  "timeout",
];

export function isExperimentRunStatus(value: string): value is ExperimentRunStatus {
  return isOneOf(value, EXPERIMENT_RUN_STATUSES);
}

export type ExperimentFailureType = "infrastructure" | "implementation" | "scientific";

const FAILURE_TYPES: readonly ExperimentFailureType[] = [
  "infrastructure",
  "implementation",
  "scientific",
];

export type ExperimentFailure = {
  readonly type: ExperimentFailureType;
  readonly message: string;
};

export type ExperimentArtifact = {
  readonly path: string;
  readonly kind: "log" | "metric" | "model" | "file" | "dir";
  readonly description?: string;
};

export type ExperimentExecutionRef =
  | {
      readonly driver: "docker";
      readonly containerName?: string;
    }
  | {
      readonly driver: "unknown";
      readonly notes: string;
    };

export type DockerSandboxProfile = "compat" | "hardened" | "gvisor";

export const DOCKER_SANDBOX_PROFILES: readonly DockerSandboxProfile[] = [
  "compat",
  "hardened",
  "gvisor",
];

export function isDockerSandboxProfile(value: string): value is DockerSandboxProfile {
  return isOneOf(value, DOCKER_SANDBOX_PROFILES);
}

export type ExperimentExecutionRequest =
  | {
      readonly driver: "docker";
      readonly kind: "smoke";
      readonly image: string;
      readonly sandboxProfile: DockerSandboxProfile;
      readonly holdSeconds: number;
      readonly timeoutMs: number;
    }
  | {
      readonly driver: "docker";
      readonly kind: "template";
      readonly image: string;
      readonly sandboxProfile: DockerSandboxProfile;
      readonly templateId: string;
      readonly timeoutMs: number;
    }
  | {
      readonly driver: "docker";
      readonly kind: "program";
      readonly image: string;
      readonly sandboxProfile: DockerSandboxProfile;
      readonly command: readonly string[];
      readonly timeoutMs: number;
    };

export type ExperimentRun = {
  readonly runId: string;
  readonly projectId: string;
  readonly planId: string;
  readonly experimentId: string;
  readonly status: ExperimentRunStatus;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly startedAt?: IsoTimestamp;
  readonly finishedAt?: IsoTimestamp;
  readonly exitCode?: number;
  readonly failure?: ExperimentFailure;
  readonly execution?: ExperimentExecutionRef;
  readonly executionRequest?: ExperimentExecutionRequest;
  readonly retryOfRunId?: string;
  readonly artifacts: readonly ExperimentArtifact[];
  readonly metricsPath?: string;
};

export type CreateExperimentRunInput = {
  readonly runId: string;
  readonly projectId: string;
  readonly planId: string;
  readonly experimentId: string;
  readonly status: ExperimentRunStatus;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly startedAt?: IsoTimestamp;
  readonly finishedAt?: IsoTimestamp;
  readonly exitCode?: number;
  readonly failure?: ExperimentFailure;
  readonly execution?: ExperimentExecutionRef;
  readonly executionRequest?: ExperimentExecutionRequest;
  readonly retryOfRunId?: string;
  readonly artifacts?: readonly ExperimentArtifact[];
  readonly metricsPath?: string;
};

export function createExperimentRun(input: CreateExperimentRunInput): ExperimentRun {
  return {
    runId: input.runId,
    projectId: input.projectId,
    planId: input.planId,
    experimentId: input.experimentId,
    status: input.status,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    exitCode: input.exitCode,
    failure: input.failure,
    execution: input.execution,
    executionRequest: input.executionRequest,
    retryOfRunId: input.retryOfRunId,
    artifacts: input.artifacts ?? [],
    metricsPath: input.metricsPath,
  };
}

function validateExperimentFailure(failure: ExperimentFailure): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(
    issues,
    !isOneOf(failure.type, FAILURE_TYPES),
    "failure.type",
    `失败类型必须是 ${FAILURE_TYPES.join("/")}`,
  );
  pushIf(issues, !isNonEmptyText(failure.message), "failure.message", "failure.message 不能为空");
  return issues;
}

function validateExperimentArtifact(artifact: ExperimentArtifact): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(artifact.path), "artifacts.path", "artifact path 不能为空");
  pushIf(issues, !isNonEmptyText(artifact.kind), "artifacts.kind", "artifact kind 不能为空");
  if (artifact.description !== undefined) {
    pushIf(
      issues,
      !isNonEmptyText(artifact.description),
      "artifacts.description",
      "description 不能为空",
    );
  }
  return issues;
}

function validateExecutionRequest(req: ExperimentExecutionRequest): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, req.driver !== "docker", "executionRequest.driver", "driver 必须是 docker");
  pushIf(issues, !isNonEmptyText(req.image), "executionRequest.image", "image 不能为空");
  pushIf(
    issues,
    !isDockerSandboxProfile(req.sandboxProfile),
    "executionRequest.sandboxProfile",
    `sandboxProfile 必须是 ${DOCKER_SANDBOX_PROFILES.join("/")}`,
  );
  pushIf(
    issues,
    !Number.isInteger(req.timeoutMs) || req.timeoutMs <= 0,
    "executionRequest.timeoutMs",
    "timeoutMs 必须是正整数",
  );

  if (req.kind === "smoke") {
    pushIf(
      issues,
      !Number.isInteger(req.holdSeconds) || req.holdSeconds <= 0,
      "executionRequest.holdSeconds",
      "holdSeconds 必须是正整数",
    );
    return issues;
  }
  if (req.kind === "template") {
    pushIf(
      issues,
      !isNonEmptyText(req.templateId),
      "executionRequest.templateId",
      "templateId 不能为空",
    );
    return issues;
  }
  if (req.kind === "program") {
    pushIf(issues, req.command.length === 0, "executionRequest.command", "command 不能为空");
    for (const [idx, item] of req.command.entries()) {
      pushIf(
        issues,
        !isNonEmptyText(item),
        `executionRequest.command[${idx}]`,
        "command item 不能为空",
      );
    }
    return issues;
  }
  pushIf(issues, true, "executionRequest.kind", "未知 kind");
  return issues;
}

export function validateExperimentRun(run: ExperimentRun): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  pushIf(issues, !isNonEmptyText(run.runId), "runId", "runId 不能为空");
  pushIf(issues, !isNonEmptyText(run.projectId), "projectId", "projectId 不能为空");
  pushIf(issues, !isNonEmptyText(run.planId), "planId", "planId 不能为空");
  pushIf(issues, !isNonEmptyText(run.experimentId), "experimentId", "experimentId 不能为空");
  pushIf(
    issues,
    !isOneOf(run.status, EXPERIMENT_RUN_STATUSES),
    "status",
    `状态必须是 ${EXPERIMENT_RUN_STATUSES.join("/")}`,
  );
  pushIf(issues, !isIsoTimestamp(run.createdAt), "createdAt", "createdAt 必须是合法时间戳");
  pushIf(issues, !isIsoTimestamp(run.updatedAt), "updatedAt", "updatedAt 必须是合法时间戳");

  if (run.startedAt !== undefined) {
    pushIf(issues, !isIsoTimestamp(run.startedAt), "startedAt", "startedAt 必须是合法时间戳");
  }
  if (run.finishedAt !== undefined) {
    pushIf(issues, !isIsoTimestamp(run.finishedAt), "finishedAt", "finishedAt 必须是合法时间戳");
  }
  if (run.exitCode !== undefined) {
    pushIf(issues, !Number.isInteger(run.exitCode), "exitCode", "exitCode 必须是整数");
  }
  if (run.failure) {
    issues.push(...validateExperimentFailure(run.failure));
  }
  for (const artifact of run.artifacts) {
    issues.push(...validateExperimentArtifact(artifact));
  }
  if (run.metricsPath !== undefined) {
    pushIf(issues, !isNonEmptyText(run.metricsPath), "metricsPath", "metricsPath 不能为空");
  }
  if (run.executionRequest) {
    issues.push(...validateExecutionRequest(run.executionRequest));
  }
  if (run.retryOfRunId !== undefined) {
    pushIf(issues, !isNonEmptyText(run.retryOfRunId), "retryOfRunId", "retryOfRunId 不能为空");
  }
  return issues;
}
