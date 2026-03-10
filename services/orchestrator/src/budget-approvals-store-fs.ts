import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import {
  approveBudgetRequest,
  rejectBudgetRequest,
  validateBudgetApprovalRequest,
  type BudgetApprovalRequest,
} from "@deepscholar/contracts";
import { readJsonFile, writeJsonFileAtomic } from "./fs/json-files.ts";
import { safeIdForFileName } from "./fs/safe-filename.ts";
import {
  resolveDeepScholarHome,
  resolveProjectPaths,
  type DeepScholarHome,
} from "./project-paths.ts";

export type BudgetApprovalStore = {
  create: (
    input: Omit<BudgetApprovalRequest, "requestId" | "createdAt" | "status">,
  ) => Promise<BudgetApprovalRequest>;
  load: (projectId: string, requestId: string) => Promise<BudgetApprovalRequest>;
  list: (
    projectId: string,
    status?: BudgetApprovalRequest["status"],
  ) => Promise<BudgetApprovalRequest[]>;
  approve: (
    projectId: string,
    requestId: string,
    decidedBy: string,
    comments?: string,
  ) => Promise<BudgetApprovalRequest>;
  reject: (
    projectId: string,
    requestId: string,
    decidedBy: string,
    comments?: string,
  ) => Promise<BudgetApprovalRequest>;
};

export type FsBudgetApprovalStoreOptions = {
  readonly homeDir?: string;
  readonly home?: DeepScholarHome;
};

function requestPath(paths: ReturnType<typeof resolveProjectPaths>, requestId: string): string {
  const safe = safeIdForFileName(requestId, "requestId");
  return path.join(paths.budgetRequestsDir, `${safe}.json`);
}

function issueSummary(req: BudgetApprovalRequest): string {
  const issues = validateBudgetApprovalRequest(req);
  return issues.map((issue) => `${issue.field}:${issue.message}`).join(", ");
}

export function createFsBudgetApprovalStore(
  options: FsBudgetApprovalStoreOptions = {},
): BudgetApprovalStore {
  const home = options.home ?? resolveDeepScholarHome(options.homeDir);

  async function create(
    input: Omit<BudgetApprovalRequest, "requestId" | "createdAt" | "status">,
  ): Promise<BudgetApprovalRequest> {
    const requestId = `budget-${crypto.randomUUID()}`;
    const createdAt = new Date().toISOString();
    const request: BudgetApprovalRequest = {
      ...input,
      requestId,
      createdAt,
      status: "pending",
    };
    const issues = validateBudgetApprovalRequest(request);
    if (issues.length > 0) {
      throw new Error(`BudgetApprovalRequest 校验失败: ${issueSummary(request)}`);
    }
    const paths = resolveProjectPaths(home, request.projectId);
    await fs.mkdir(paths.budgetRequestsDir, { recursive: true });
    await writeJsonFileAtomic(requestPath(paths, requestId), request);
    return request;
  }

  async function load(projectId: string, requestId: string): Promise<BudgetApprovalRequest> {
    const paths = resolveProjectPaths(home, projectId);
    return await readJsonFile<BudgetApprovalRequest>(requestPath(paths, requestId));
  }

  async function list(
    projectId: string,
    status?: BudgetApprovalRequest["status"],
  ): Promise<BudgetApprovalRequest[]> {
    const paths = resolveProjectPaths(home, projectId);
    try {
      const entries = await fs.readdir(paths.budgetRequestsDir, { withFileTypes: true });
      const files = entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json"));
      const requests = await Promise.all(
        files.map(async (entry) =>
          readJsonFile<BudgetApprovalRequest>(path.join(paths.budgetRequestsDir, entry.name)),
        ),
      );
      if (!status) {
        return requests;
      }
      return requests.filter((req) => req.status === status);
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "ENOENT") {
        return [];
      }
      throw err;
    }
  }

  async function persist(req: BudgetApprovalRequest): Promise<void> {
    const issues = validateBudgetApprovalRequest(req);
    if (issues.length > 0) {
      throw new Error(`BudgetApprovalRequest 校验失败: ${issueSummary(req)}`);
    }
    const paths = resolveProjectPaths(home, req.projectId);
    await fs.mkdir(paths.budgetRequestsDir, { recursive: true });
    await writeJsonFileAtomic(requestPath(paths, req.requestId), req);
  }

  async function approve(
    projectId: string,
    requestId: string,
    decidedBy: string,
    comments?: string,
  ): Promise<BudgetApprovalRequest> {
    const request = await load(projectId, requestId);
    const decidedAt = new Date().toISOString();
    const approved = approveBudgetRequest({ request, decidedAt, decidedBy, comments });
    await persist(approved);
    return approved;
  }

  async function reject(
    projectId: string,
    requestId: string,
    decidedBy: string,
    comments?: string,
  ): Promise<BudgetApprovalRequest> {
    const request = await load(projectId, requestId);
    const decidedAt = new Date().toISOString();
    const rejected = rejectBudgetRequest({ request, decidedAt, decidedBy, comments });
    await persist(rejected);
    return rejected;
  }

  return { create, load, list, approve, reject };
}
