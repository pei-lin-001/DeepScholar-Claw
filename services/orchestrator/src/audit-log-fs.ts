import fs from "node:fs/promises";
import path from "node:path";
import { validateAuditEntry, type AuditEntry } from "@deepscholar/contracts";
import { appendJsonlLine, readJsonlFile } from "./fs/jsonl-files.ts";
import {
  resolveDeepScholarHome,
  resolveProjectPaths,
  type DeepScholarHome,
} from "./project-paths.ts";

export type FsAuditLogOptions = {
  readonly homeDir?: string;
  readonly home?: DeepScholarHome;
};

export type AuditLogStore = {
  append: (projectId: string, entry: AuditEntry) => Promise<void>;
  list: (projectId: string) => Promise<AuditEntry[]>;
};

function issueSummary(entry: AuditEntry): string {
  const issues = validateAuditEntry(entry);
  return issues.map((issue) => `${issue.field}:${issue.message}`).join(", ");
}

export function createFsAuditLogStore(options: FsAuditLogOptions = {}): AuditLogStore {
  const home = options.home ?? resolveDeepScholarHome(options.homeDir);

  async function append(projectId: string, entry: AuditEntry): Promise<void> {
    const issues = validateAuditEntry(entry);
    if (issues.length > 0) {
      throw new Error(`AuditEntry 校验失败: ${issueSummary(entry)}`);
    }
    const paths = resolveProjectPaths(home, projectId);
    await fs.mkdir(path.dirname(paths.auditLogPath), { recursive: true });
    await appendJsonlLine(paths.auditLogPath, entry);
  }

  async function list(projectId: string): Promise<AuditEntry[]> {
    const paths = resolveProjectPaths(home, projectId);
    return await readJsonlFile<AuditEntry>(paths.auditLogPath);
  }

  return { append, list };
}
