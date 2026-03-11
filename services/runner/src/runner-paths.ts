import os from "node:os";
import path from "node:path";
import { safeIdForFileName } from "./fs/safe-filename.ts";

export type DeepScholarHome = {
  readonly rootDir: string;
};

export type RunnerProjectPaths = {
  readonly projectDir: string;
  readonly runsDir: string;
};

export type RunPaths = {
  readonly runDir: string;
  readonly runJsonPath: string;
  readonly stdoutPath: string;
  readonly stderrPath: string;
  readonly metricsPath: string;
};

export function resolveDeepScholarHome(rootDir?: string): DeepScholarHome {
  const resolved = rootDir ?? path.join(os.homedir(), ".deepscholar");
  return { rootDir: resolved };
}

export function resolveRunnerProjectPaths(
  home: DeepScholarHome,
  projectId: string,
): RunnerProjectPaths {
  const safeProjectId = safeIdForFileName(projectId, "projectId");
  const projectDir = path.join(home.rootDir, "projects", safeProjectId);
  const runsDir = path.join(projectDir, "runs");
  return { projectDir, runsDir };
}

export function resolveRunPaths(home: DeepScholarHome, projectId: string, runId: string): RunPaths {
  const project = resolveRunnerProjectPaths(home, projectId);
  const safeRunId = safeIdForFileName(runId, "runId");
  const runDir = path.join(project.runsDir, safeRunId);
  return {
    runDir,
    runJsonPath: path.join(runDir, "run.json"),
    stdoutPath: path.join(runDir, "stdout.log"),
    stderrPath: path.join(runDir, "stderr.log"),
    metricsPath: path.join(runDir, "metrics.json"),
  };
}
