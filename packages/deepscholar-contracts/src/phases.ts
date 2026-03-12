export const RESEARCH_PHASES = [
  "charter",
  "literature",
  "proposal",
  "plan",
  "experiment",
  "validation",
  "writing",
  "review",
  "handoff",
] as const;

export type ResearchPhase = (typeof RESEARCH_PHASES)[number];

export function isResearchPhase(value: string): value is ResearchPhase {
  return RESEARCH_PHASES.includes(value as ResearchPhase);
}
