import { pathToFileURL } from "node:url";
import {
  createBudgetEnvelope,
  createProjectCharter,
  type BudgetEnvelope,
  type CreateProjectCharterInput,
  type ProjectCharter,
  validateProjectCharter,
} from "./charter.ts";
import {
  collectUnverifiedClaims,
  createClaimLedgerEntry,
  type ClaimAggregation,
  type ClaimLedgerEntry,
  type CreateClaimLedgerEntryInput,
  validateClaimLedgerEntry,
} from "./claims.ts";
import { RESEARCH_PHASES, isResearchPhase, type ResearchPhase } from "./phases.ts";
import {
  createExperimentSpec,
  createResearchPlan,
  type BaselineSpec,
  type CreateResearchPlanInput,
  type ExperimentSpec,
  type ResearchPlan,
  validateExperimentSpec,
  validateResearchPlan,
} from "./plan.ts";
import { CORE_SERVICE_IDS, type CoreServiceId, type ServiceDescriptor } from "./services.ts";
import type { ValidationIssue } from "./validation.ts";

export {
  CORE_SERVICE_IDS,
  RESEARCH_PHASES,
  collectUnverifiedClaims,
  createBudgetEnvelope,
  createClaimLedgerEntry,
  createExperimentSpec,
  createProjectCharter,
  createResearchPlan,
  isResearchPhase,
  validateClaimLedgerEntry,
  validateExperimentSpec,
  validateProjectCharter,
  validateResearchPlan,
};

export type {
  BaselineSpec,
  BudgetEnvelope,
  ClaimLedgerEntry,
  ClaimAggregation,
  CoreServiceId,
  CreateClaimLedgerEntryInput,
  CreateProjectCharterInput,
  CreateResearchPlanInput,
  ExperimentSpec,
  ProjectCharter,
  ResearchPhase,
  ResearchPlan,
  ServiceDescriptor,
  ValidationIssue,
};

export const contractSummary = {
  phases: RESEARCH_PHASES,
  services: CORE_SERVICE_IDS,
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  console.log(JSON.stringify(contractSummary, null, 2));
}
