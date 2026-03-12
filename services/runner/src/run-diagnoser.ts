import type { ExperimentRunStatus } from "@deepscholar/contracts";
import { classifyFailure, failurePolicy, type FailureSignal, type FailureType } from "./failure.ts";
import { collectRunSummary, type RunCollectedSnapshot } from "./run-collector.ts";
import type { RunStore } from "./run-store-fs.ts";

export type RunDiagnosisPolicy = {
  readonly nextAction: "none" | "retry" | "debug_fix" | "pivot";
  readonly maxRetries: number;
};

export type RunDiagnosis = {
  readonly projectId: string;
  readonly runId: string;
  readonly status: ExperimentRunStatus;
  readonly rootCause: string;
  readonly suggestedFix: string;
  readonly policy: RunDiagnosisPolicy;
  readonly signals?: FailureSignal;
  readonly failureType?: FailureType;
  readonly stage?: string;
};

const DEFAULT_TAIL_BYTES = 4096;

const RUNTIME_ERROR_PATTERNS: readonly RegExp[] = [
  /traceback\s*\(most recent call last\)/i,
  /modulenotfounderror:/i,
  /syntaxerror:/i,
  /\bexception\b/i,
];

const ENVIRONMENT_ERROR_PATTERNS: readonly RegExp[] = [
  /cannot connect to the docker daemon/i,
  /error response from daemon/i,
  /pull access denied/i,
  /manifest unknown/i,
  /no matching manifest/i,
];

function extractLatestRunnerStage(stderrTail: string): string | undefined {
  const lines = stderrTail.split("\n");
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i] ?? "";
    if (!line.includes("[runner]") || !line.includes("stage=")) {
      continue;
    }
    const match = line.match(/\bstage=([^\s]+)/);
    if (match?.[1]) {
      return match[1];
    }
  }
  return undefined;
}

function containsAnyPattern(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function metricsHealthy(metrics: unknown): boolean {
  if (!isObjectRecord(metrics)) {
    return false;
  }
  const raw = metrics.health;
  return typeof raw === "number" && Number.isFinite(raw) && raw > 0;
}

function hasRuntimeError(stderrTail: string): boolean {
  return containsAnyPattern(stderrTail, RUNTIME_ERROR_PATTERNS);
}

function hasEnvironmentError(
  stage: string | undefined,
  stderrTail: string,
  exitCode: number | null,
): boolean {
  if (stage?.startsWith("image.")) {
    return true;
  }
  if (exitCode === 125) {
    return true;
  }
  return containsAnyPattern(stderrTail, ENVIRONMENT_ERROR_PATTERNS);
}

function buildFailureSignal(summary: RunCollectedSnapshot): FailureSignal {
  const status = summary.run.status;
  const timedOut = status === "timeout";
  const exitCode = summary.run.exitCode ?? null;
  const stage = extractLatestRunnerStage(summary.stderrTail);

  return {
    timedOut,
    exitCode,
    hasEnvironmentError: hasEnvironmentError(stage, summary.stderrTail, exitCode),
    hasRuntimeError: hasRuntimeError(summary.stderrTail),
    metricsHealthy: metricsHealthy(summary.metrics),
    reproduced: false,
  };
}

function policyForStatus(
  status: ExperimentRunStatus,
  signal?: FailureSignal,
): {
  readonly policy: RunDiagnosisPolicy;
  readonly failureType?: FailureType;
} {
  if (status === "succeeded" || status === "queued" || status === "running") {
    return { policy: { nextAction: "none", maxRetries: 0 } };
  }
  const failureType = classifyFailure(
    signal ?? {
      timedOut: status === "timeout",
      exitCode: null,
      hasEnvironmentError: false,
      hasRuntimeError: false,
      metricsHealthy: false,
      reproduced: false,
    },
  );
  const policy = failurePolicy(failureType);
  return {
    failureType,
    policy: { nextAction: policy.nextAction, maxRetries: policy.maxRetries },
  };
}

function rootCauseForStatus(params: {
  readonly status: ExperimentRunStatus;
  readonly signal?: FailureSignal;
  readonly stage?: string;
}): string {
  if (params.status === "succeeded") {
    return "运行成功（status=succeeded），未检测到失败信号。";
  }
  if (params.status === "queued") {
    return "运行仍在排队（status=queued），目前没有可诊断的失败结果。";
  }
  if (params.status === "running") {
    return "运行仍在进行中（status=running），请等待结束或查看日志尾部定位卡点。";
  }
  if (params.status === "aborted") {
    return "运行被手动终止（status=aborted）。";
  }
  if (params.status === "timeout") {
    return `运行超时（status=timeout），被 Runner 切断。最后阶段: ${params.stage ?? "unknown"}`;
  }

  const signal = params.signal;
  if (!signal) {
    return "运行失败（status=failed），但缺少日志/metrics 证据，无法进一步分型。";
  }
  if (signal.exitCode === 137) {
    return `容器被杀（疑似 OOM 或资源回收，exitCode=137）。最后阶段: ${params.stage ?? "unknown"}`;
  }
  if (signal.hasEnvironmentError) {
    return `环境/容器层面失败（镜像/daemon/沙箱参数等）。最后阶段: ${params.stage ?? "unknown"}`;
  }
  if (signal.hasRuntimeError) {
    return "脚本/程序运行时抛错退出（stderr 尾部应包含异常栈）。";
  }
  return `程序非零退出（exitCode=${String(signal.exitCode ?? "null")}）。`;
}

function suggestedFixForPolicy(params: {
  readonly status: ExperimentRunStatus;
  readonly policy: RunDiagnosisPolicy;
  readonly stage?: string;
}): string {
  if (params.policy.nextAction === "none") {
    if (params.status === "running") {
      return "可先用 collect 查看 stderr.log 的最后阶段；必要时 abort 终止。";
    }
    return "无需采取重试动作。";
  }
  if (params.policy.nextAction === "retry") {
    if (params.stage?.startsWith("image.")) {
      return "优先检查镜像名是否正确、Docker daemon 是否可用；确认后再执行显式重试。";
    }
    if (params.status === "timeout") {
      return "考虑提高 timeout 或缩短任务；确认后再执行显式重试。";
    }
    return "先执行显式重试；若重复失败，再根据 stderr.log 的阶段留痕定位根因。";
  }
  if (params.policy.nextAction === "debug_fix") {
    return "打开 stderr.log 尾部找到第一条异常栈，修复代码/依赖后再显式重试。";
  }
  return "这类失败更像“方向不对而不是代码坏了”：减少无效重试，改实验假设/数据/指标再开新实验。";
}

export async function diagnoseRun(params: {
  readonly store: RunStore;
  readonly projectId: string;
  readonly runId: string;
  readonly tailBytes?: number;
}): Promise<RunDiagnosis> {
  const summary = await collectRunSummary({
    store: params.store,
    projectId: params.projectId,
    runId: params.runId,
    tailBytes: params.tailBytes ?? DEFAULT_TAIL_BYTES,
  });
  const stage = extractLatestRunnerStage(summary.stderrTail);
  const signal = buildFailureSignal(summary);
  const resolved = policyForStatus(summary.run.status, signal);
  const rootCause = rootCauseForStatus({ status: summary.run.status, signal, stage });
  const suggestedFix = suggestedFixForPolicy({
    status: summary.run.status,
    policy: resolved.policy,
    stage,
  });

  return {
    projectId: summary.run.projectId,
    runId: summary.run.runId,
    status: summary.run.status,
    rootCause,
    suggestedFix,
    policy: resolved.policy,
    signals: signal,
    failureType: resolved.failureType,
    stage,
  };
}
