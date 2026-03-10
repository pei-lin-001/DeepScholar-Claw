import fs from "node:fs/promises";
import path from "node:path";
import { readJsonFile, writeJsonFileAtomic } from "./fs/json-files.ts";
import { safeIdForFileName } from "./fs/safe-filename.ts";
import {
  resolveDeepScholarHome,
  resolveProjectPaths,
  type DeepScholarHome,
} from "./project-paths.ts";

export type FsCheckpointStoreOptions = {
  readonly homeDir?: string;
  readonly home?: DeepScholarHome;
};

export type CheckpointRecord<T> = {
  readonly checkpointId: string;
  readonly createdAtIso: string;
  readonly value: T;
};

export type CheckpointStore = {
  write: <T>(projectId: string, label: string, value: T) => Promise<string>;
  readLatest: <T>(
    projectId: string,
  ) => Promise<{ path: string; record: CheckpointRecord<T> } | null>;
};

function checkpointFileName(label: string, createdAtIso: string): string {
  const safeLabel = safeIdForFileName(label, "label");
  const safeTime = safeIdForFileName(createdAtIso, "createdAt");
  return `${safeLabel}_${safeTime}.json`;
}

export function createFsCheckpointStore(options: FsCheckpointStoreOptions = {}): CheckpointStore {
  const home = options.home ?? resolveDeepScholarHome(options.homeDir);

  async function listCheckpointFiles(projectId: string): Promise<string[]> {
    const paths = resolveProjectPaths(home, projectId);
    const entries = await fs.readdir(paths.checkpointsDir, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(paths.checkpointsDir, entry.name));
  }

  async function write<T>(projectId: string, label: string, value: T): Promise<string> {
    const paths = resolveProjectPaths(home, projectId);
    await fs.mkdir(paths.checkpointsDir, { recursive: true });
    const createdAtIso = new Date().toISOString();
    const checkpointId = `ckpt-${Date.now()}`;
    const record: CheckpointRecord<T> = { checkpointId, createdAtIso, value };
    const filePath = path.join(paths.checkpointsDir, checkpointFileName(label, createdAtIso));
    await writeJsonFileAtomic(filePath, record);
    return filePath;
  }

  async function readLatest<T>(
    projectId: string,
  ): Promise<{ path: string; record: CheckpointRecord<T> } | null> {
    try {
      const candidates = await listCheckpointFiles(projectId);
      if (candidates.length === 0) {
        return null;
      }

      const records = await Promise.all(
        candidates.map(async (candidatePath) => ({
          path: candidatePath,
          record: await readJsonFile<CheckpointRecord<T>>(candidatePath),
        })),
      );

      const latest = records
        .map((row) => ({ ...row, ts: Date.parse(row.record.createdAtIso) }))
        .filter((row) => Number.isFinite(row.ts))
        .toSorted((a, b) => a.ts - b.ts)
        .pop();

      if (!latest) {
        throw new Error("找不到带合法 createdAtIso 的 checkpoint 文件");
      }

      return { path: latest.path, record: latest.record };
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
        return null;
      }
      throw err;
    }
  }

  return { write, readLatest };
}
