import {
  DOCKER_SANDBOX_PROFILES,
  createFsRunStore,
  createNodeDockerClient,
  isDockerSandboxProfile,
  type DockerClient,
  type DockerSandboxProfile,
  type RunCollectedSnapshot,
  type RunStore,
} from "../../services/runner/src/index.js";
import { defaultRuntime, type RuntimeEnv } from "../runtime.js";

export const DEFAULT_IMAGE = "alpine:3.20";
export const DEFAULT_HOLD_SECONDS = 1;
export const DEFAULT_TIMEOUT_SECONDS = 120;
export const DEFAULT_COLLECT_TAIL_BYTES = 4096;
export const DEFAULT_SANDBOX_PROFILE: DockerSandboxProfile = "compat";

export type RunnerCliRuntime = Pick<RuntimeEnv, "log" | "error" | "exit">;

export type RunnerCliDeps = {
  readonly store: RunStore;
  readonly docker: DockerClient;
};

export type RunnerCliDepsFactory = (homeDir?: string) => RunnerCliDeps;

export const defaultRunnerCliRuntime: RunnerCliRuntime = defaultRuntime;

export const createDefaultRunnerCliDeps: RunnerCliDepsFactory = (homeDir?: string) => {
  return {
    store: createFsRunStore({ homeDir }),
    docker: createNodeDockerClient(),
  };
};

export function parseNonEmptyText(raw: unknown, label: string, fallback?: string): string {
  if (raw === undefined || raw === null || raw === "") {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`${label} 不能为空`);
  }
  if (typeof raw !== "string") {
    throw new Error(`${label} 必须是字符串`);
  }
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new Error(`${label} 不能为空`);
  }
  return trimmed;
}

export function parsePositiveInt(raw: unknown, label: string, fallback: number): number {
  if (raw === undefined || raw === null || raw === "") {
    return fallback;
  }
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
    throw new Error(`${label} 必须是正整数`);
  }
  return n;
}

export function parseSandboxProfile(raw: unknown): DockerSandboxProfile {
  const value = parseNonEmptyText(raw, "sandbox-profile", DEFAULT_SANDBOX_PROFILE);
  if (isDockerSandboxProfile(value)) {
    return value;
  }
  throw new Error(`sandbox-profile 必须是 ${DOCKER_SANDBOX_PROFILES.join("/")}`);
}

export function printJsonOrSummary(
  runtime: RunnerCliRuntime,
  opts: Record<string, unknown>,
  value: unknown,
  summary: string,
): void {
  if (opts.json) {
    runtime.log(JSON.stringify(value, null, 2));
    return;
  }
  runtime.log(summary);
}

export function printCollectedSummary(
  runtime: RunnerCliRuntime,
  summary: RunCollectedSnapshot,
): void {
  runtime.log(`runId=${summary.run.runId} status=${summary.run.status}`);
  runtime.log(`metrics=${JSON.stringify(summary.metrics)}`);
  runtime.log("--- stdout (tail) ---");
  runtime.log(summary.stdoutTail.trimEnd());
  runtime.log("--- stderr (tail) ---");
  runtime.log(summary.stderrTail.trimEnd());
}
