import os from "node:os";
import path from "node:path";

export type DeepScholarHome = {
  readonly rootDir: string;
};

export type ProjectPaths = {
  readonly projectDir: string;
  readonly metaPath: string;
  readonly checkpointsDir: string;
  readonly auditLogPath: string;
  readonly memoryDir: string;
  readonly memoryWorkingPath: string;
  readonly memoryRecallPath: string;
  readonly memoryArchivalPath: string;
  readonly budgetRequestsDir: string;
};

export function resolveDeepScholarHome(rootDir?: string): DeepScholarHome {
  const resolved = rootDir ?? path.join(os.homedir(), ".deepscholar");
  return { rootDir: resolved };
}

export function resolveProjectPaths(home: DeepScholarHome, projectId: string): ProjectPaths {
  const projectDir = path.join(home.rootDir, "projects", projectId);
  const checkpointsDir = path.join(projectDir, "checkpoints");
  const memoryDir = path.join(projectDir, "memory");
  const budgetRequestsDir = path.join(projectDir, "budget", "requests");
  return {
    projectDir,
    metaPath: path.join(projectDir, "meta.json"),
    checkpointsDir,
    auditLogPath: path.join(projectDir, "audit_log.jsonl"),
    memoryDir,
    memoryWorkingPath: path.join(memoryDir, "working.jsonl"),
    memoryRecallPath: path.join(memoryDir, "recall.jsonl"),
    memoryArchivalPath: path.join(memoryDir, "archival.jsonl"),
    budgetRequestsDir,
  };
}
