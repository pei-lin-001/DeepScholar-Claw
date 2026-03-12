import fs from "node:fs/promises";
import path from "node:path";
import { validateResearchProject, type ResearchProject } from "@deepscholar/contracts";
import type { CheckpointStore } from "./checkpoints-fs.ts";
import { createFsCheckpointStore } from "./checkpoints-fs.ts";
import { readJsonFile, writeJsonFileAtomic } from "./fs/json-files.ts";
import {
  resolveDeepScholarHome,
  resolveProjectPaths,
  type DeepScholarHome,
} from "./project-paths.ts";

export type FsProjectStoreOptions = {
  readonly homeDir?: string;
  readonly home?: DeepScholarHome;
  readonly checkpoints?: CheckpointStore;
};

export type ProjectStore = {
  init: (project: ResearchProject) => Promise<void>;
  load: (projectId: string) => Promise<ResearchProject>;
  save: (project: ResearchProject) => Promise<void>;
  checkpoint: (project: ResearchProject, label: string) => Promise<string>;
  restoreLatestCheckpoint: (
    projectId: string,
  ) => Promise<{ path: string; project: ResearchProject } | null>;
};

function issueSummary(project: ResearchProject): string {
  const issues = validateResearchProject(project);
  return issues.map((issue) => `${issue.field}:${issue.message}`).join(", ");
}

export function createFsProjectStore(options: FsProjectStoreOptions = {}): ProjectStore {
  const home = options.home ?? resolveDeepScholarHome(options.homeDir);
  const checkpoints = options.checkpoints ?? createFsCheckpointStore({ home });

  async function init(project: ResearchProject): Promise<void> {
    const issues = validateResearchProject(project);
    if (issues.length > 0) {
      throw new Error(`ResearchProject 校验失败: ${issueSummary(project)}`);
    }
    const paths = resolveProjectPaths(home, project.projectId);
    await fs.mkdir(paths.projectDir, { recursive: true });
    await fs.mkdir(paths.checkpointsDir, { recursive: true });
    await fs.mkdir(paths.budgetRequestsDir, { recursive: true });
    await fs.mkdir(path.dirname(paths.auditLogPath), { recursive: true });
    await writeJsonFileAtomic(paths.metaPath, project);
  }

  async function load(projectId: string): Promise<ResearchProject> {
    const paths = resolveProjectPaths(home, projectId);
    return await readJsonFile<ResearchProject>(paths.metaPath);
  }

  async function save(project: ResearchProject): Promise<void> {
    const issues = validateResearchProject(project);
    if (issues.length > 0) {
      throw new Error(`ResearchProject 校验失败: ${issueSummary(project)}`);
    }
    const paths = resolveProjectPaths(home, project.projectId);
    await writeJsonFileAtomic(paths.metaPath, project);
  }

  async function checkpoint(project: ResearchProject, label: string): Promise<string> {
    return await checkpoints.write(project.projectId, label, project);
  }

  async function restoreLatestCheckpoint(
    projectId: string,
  ): Promise<{ path: string; project: ResearchProject } | null> {
    const latest = await checkpoints.readLatest<ResearchProject>(projectId);
    if (!latest) {
      return null;
    }
    const issues = validateResearchProject(latest.record.value);
    if (issues.length > 0) {
      throw new Error(
        `checkpoint 内容不是合法 ResearchProject: ${issueSummary(latest.record.value)}`,
      );
    }
    const project = latest.record.value;
    const paths = resolveProjectPaths(home, projectId);
    await writeJsonFileAtomic(paths.metaPath, project);
    return { path: latest.path, project };
  }

  return { init, load, save, checkpoint, restoreLatestCheckpoint };
}
