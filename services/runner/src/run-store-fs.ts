import fs from "node:fs/promises";
import {
  createExperimentRun,
  nowIsoTimestamp,
  validateExperimentRun,
  type ExperimentRun,
  type ExperimentRunStatus,
} from "@deepscholar/contracts";
import { readJsonFile, writeJsonFileAtomic } from "./fs/json-files.ts";
import {
  resolveDeepScholarHome,
  resolveRunnerProjectPaths,
  resolveRunPaths,
  type DeepScholarHome,
  type RunPaths,
} from "./runner-paths.ts";

export type FsRunStoreOptions = {
  readonly homeDir?: string;
  readonly home?: DeepScholarHome;
};

export type RunStore = {
  create: (input: {
    readonly runId: string;
    readonly projectId: string;
    readonly planId: string;
    readonly experimentId: string;
    readonly status?: ExperimentRunStatus;
  }) => Promise<{ run: ExperimentRun; paths: RunPaths }>;
  load: (projectId: string, runId: string) => Promise<ExperimentRun>;
  save: (run: ExperimentRun) => Promise<void>;
  list: (projectId: string) => Promise<ExperimentRun[]>;
  pathsFor: (projectId: string, runId: string) => RunPaths;
};

function issueSummary(run: ExperimentRun): string {
  const issues = validateExperimentRun(run);
  return issues.map((issue) => `${issue.field}:${issue.message}`).join(", ");
}

function compareRunsNewestFirst(a: ExperimentRun, b: ExperimentRun): number {
  const byUpdatedAt = b.updatedAt.localeCompare(a.updatedAt);
  if (byUpdatedAt !== 0) {
    return byUpdatedAt;
  }
  return a.runId.localeCompare(b.runId);
}

export function createFsRunStore(options: FsRunStoreOptions = {}): RunStore {
  const home = options.home ?? resolveDeepScholarHome(options.homeDir);

  function pathsFor(projectId: string, runId: string): RunPaths {
    return resolveRunPaths(home, projectId, runId);
  }

  async function create(input: {
    readonly runId: string;
    readonly projectId: string;
    readonly planId: string;
    readonly experimentId: string;
    readonly status?: ExperimentRunStatus;
  }): Promise<{ run: ExperimentRun; paths: RunPaths }> {
    const now = nowIsoTimestamp();
    const run = createExperimentRun({
      runId: input.runId,
      projectId: input.projectId,
      planId: input.planId,
      experimentId: input.experimentId,
      status: input.status ?? "queued",
      createdAt: now,
      updatedAt: now,
      artifacts: [],
    });
    const issues = validateExperimentRun(run);
    if (issues.length > 0) {
      throw new Error(`ExperimentRun 校验失败: ${issueSummary(run)}`);
    }
    const paths = pathsFor(input.projectId, input.runId);
    await fs.mkdir(paths.runDir, { recursive: true });
    await fs.writeFile(paths.stdoutPath, "", "utf8");
    await fs.writeFile(paths.stderrPath, "", "utf8");
    await fs.writeFile(paths.metricsPath, "{}", "utf8");
    await writeJsonFileAtomic(paths.runJsonPath, run);
    return { run, paths };
  }

  async function load(projectId: string, runId: string): Promise<ExperimentRun> {
    const paths = pathsFor(projectId, runId);
    return await readJsonFile<ExperimentRun>(paths.runJsonPath);
  }

  async function save(run: ExperimentRun): Promise<void> {
    const issues = validateExperimentRun(run);
    if (issues.length > 0) {
      throw new Error(`ExperimentRun 校验失败: ${issueSummary(run)}`);
    }
    const paths = pathsFor(run.projectId, run.runId);
    await writeJsonFileAtomic(paths.runJsonPath, run);
  }

  async function list(projectId: string): Promise<ExperimentRun[]> {
    const project = resolveRunnerProjectPaths(home, projectId);
    const dir = project.runsDir;
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      const runDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
      const runs = await Promise.all(runDirs.map((runId) => load(projectId, runId)));
      return runs.toSorted(compareRunsNewestFirst);
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
        return [];
      }
      throw err;
    }
  }

  return { create, load, save, list, pathsFor };
}
