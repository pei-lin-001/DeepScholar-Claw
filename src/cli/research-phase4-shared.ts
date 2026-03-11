import type { ResearchProject } from "../../packages/deepscholar-contracts/src/index.ts";
import type { PaperVenueTemplateId } from "../../packages/deepscholar-contracts/src/index.ts";
import type { OrchestratorDeps } from "../../services/orchestrator/src/index.js";
import {
  createDockerLatexCompiler,
  createNodeCommandExecutor,
  type LatexCompiler,
} from "../../services/writing/src/index.js";
import { createOrchestratorDeps } from "./research-orchestrator-helpers.js";

export const DEFAULT_VENUE: PaperVenueTemplateId = "arxiv";
export const DEFAULT_BIB_YEAR = String(new Date().getFullYear());
export const DEFAULT_TEX_IMAGE = "texlive/texlive";
export const DEFAULT_TIMEOUT_SECONDS = 120;

export type Phase4CliDeps = {
  readonly orchestrator: OrchestratorDeps;
  readonly createLatexCompiler: (image: string) => LatexCompiler;
};

export type Phase4CliDepsFactory = (homeDir?: string) => Phase4CliDeps;

export const createDefaultDeps: Phase4CliDepsFactory = (homeDir?: string) => {
  const exec = createNodeCommandExecutor();
  return {
    orchestrator: createOrchestratorDeps(homeDir),
    createLatexCompiler: (image: string) => createDockerLatexCompiler({ exec, image }),
  };
};

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

export function requireStep(project: ResearchProject, step: ResearchProject["step"]): void {
  if (project.step !== step) {
    throw new Error(`当前步骤不是 ${step}，不能执行该操作: step=${project.step}`);
  }
}
