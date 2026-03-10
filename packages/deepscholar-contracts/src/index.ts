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
  createAssertion,
  createClaim,
  createEvidenceBinding,
  isAssertionVerified,
  isClaimVerified,
  type Assertion,
  type AssertionType,
  type BaselineComparison,
  type Claim,
  type ClaimAggregation,
  type ClaimAuditStatus,
  type ClaimStrength,
  type CreateAssertionInput,
  type CreateClaimInput,
  type CreateEvidenceBindingInput,
  type EvidenceBinding,
  validateAssertion,
  validateClaim,
  validateEvidenceBinding,
} from "./claims.ts";
import {
  createExperimentSpec,
  type CreateExperimentSpecInput,
  type ExperimentSpec,
  validateExperimentSpec,
} from "./experiment.ts";
import { RESEARCH_PHASES, isResearchPhase, type ResearchPhase } from "./phases.ts";
import {
  createResearchPlanDraft,
  freezeResearchPlan,
  type BaselineSpec,
  type CreateResearchPlanDraftInput,
  type FreezeResearchPlanInput,
  type ResearchPlan,
  type ResearchPlanDraft,
  validateResearchPlan,
  validateResearchPlanDraft,
} from "./plan.ts";
import { CORE_SERVICE_IDS, type CoreServiceId, type ServiceDescriptor } from "./services.ts";
import { isIsoTimestamp, nowIsoTimestamp, type IsoTimestamp } from "./time.ts";
import type { ValidationIssue } from "./validation.ts";

export {
  CORE_SERVICE_IDS,
  RESEARCH_PHASES,
  collectUnverifiedClaims,
  createBudgetEnvelope,
  createAssertion,
  createClaim,
  createEvidenceBinding,
  createExperimentSpec,
  createProjectCharter,
  createResearchPlanDraft,
  freezeResearchPlan,
  isResearchPhase,
  isAssertionVerified,
  isClaimVerified,
  isIsoTimestamp,
  nowIsoTimestamp,
  validateAssertion,
  validateClaim,
  validateEvidenceBinding,
  validateExperimentSpec,
  validateProjectCharter,
  validateResearchPlan,
  validateResearchPlanDraft,
};

export type {
  Assertion,
  AssertionType,
  BaselineComparison,
  BaselineSpec,
  BudgetEnvelope,
  Claim,
  ClaimAggregation,
  ClaimAuditStatus,
  ClaimStrength,
  CoreServiceId,
  CreateAssertionInput,
  CreateClaimInput,
  CreateEvidenceBindingInput,
  CreateExperimentSpecInput,
  CreateProjectCharterInput,
  CreateResearchPlanDraftInput,
  EvidenceBinding,
  ExperimentSpec,
  FreezeResearchPlanInput,
  IsoTimestamp,
  ProjectCharter,
  ResearchPhase,
  ResearchPlan,
  ResearchPlanDraft,
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
