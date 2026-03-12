import fs from "node:fs/promises";
import {
  createFsAuditLogStore,
  createFsBudgetApprovalStore,
  createFsProjectStore,
} from "../../services/orchestrator/src/index.js";

export type CliRuntime = {
  readonly log: (...args: unknown[]) => void;
  readonly error: (message: string) => void;
  readonly exit: (code: number) => void;
};

export const DEFAULT_REQUESTOR = "budget-bot";

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

export function parseFiniteNumber(raw: unknown, label: string): number {
  if (raw === undefined || raw === null || raw === "") {
    throw new Error(`${label} 不能为空`);
  }
  const n = typeof raw === "number" ? raw : typeof raw === "string" ? Number(raw) : NaN;
  if (!Number.isFinite(n)) {
    throw new Error(`${label} 必须是有限数字`);
  }
  return n;
}

export function createOrchestratorDeps(homeDir?: string) {
  return {
    projects: createFsProjectStore({ homeDir }),
    approvals: createFsBudgetApprovalStore({ homeDir }),
    audit: createFsAuditLogStore({ homeDir }),
  };
}

export async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  try {
    return JSON.parse(raw) as T;
  } catch (err) {
    throw new Error(`无法解析 JSON: ${filePath}: ${String(err)}`, { cause: err });
  }
}

export function printJsonOrSummary(
  opts: Record<string, unknown>,
  value: unknown,
  summary: string,
  log: (...args: unknown[]) => void = console.log,
): void {
  if (opts.json) {
    log(JSON.stringify(value, null, 2));
    return;
  }
  log(summary);
}
