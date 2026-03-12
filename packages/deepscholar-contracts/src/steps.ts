export const RESEARCH_STEPS = [
  "step0_plan_freeze",
  "step1_literature_crawl",
  "step2_graph_build",
  "step3_novelty_discovery",
  "step4_internal_workshop",
  "step5_human_topic_select",
  "step6_experiment_design",
  "step7_resource_approval",
  "step8_cloud_experiment",
  "step9_result_validation",
  "step10_paper_writing",
  "step11_peer_review",
  "step12_human_final",
] as const;

export type ResearchStep = (typeof RESEARCH_STEPS)[number];

export function isResearchStep(value: string): value is ResearchStep {
  return RESEARCH_STEPS.includes(value as ResearchStep);
}

const STEP_ORDER = new Map(RESEARCH_STEPS.map((step, index) => [step, index]));

export function getNextResearchStep(step: ResearchStep): ResearchStep | null {
  const index = STEP_ORDER.get(step) ?? -1;
  return RESEARCH_STEPS[index + 1] ?? null;
}
