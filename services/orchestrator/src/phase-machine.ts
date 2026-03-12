import { RESEARCH_PHASES, type ResearchPhase } from "@deepscholar/contracts";

export type PhaseState = {
  readonly current: ResearchPhase;
  readonly completed: readonly ResearchPhase[];
};

const PHASE_ORDER = new Map(RESEARCH_PHASES.map((phase, index) => [phase, index]));

export function createInitialPhaseState(): PhaseState {
  return { current: "charter", completed: [] };
}

export function getNextResearchPhase(current: ResearchPhase): ResearchPhase | null {
  const index = PHASE_ORDER.get(current) ?? -1;
  return RESEARCH_PHASES[index + 1] ?? null;
}

export function canAdvancePhase(state: PhaseState, next: ResearchPhase): boolean {
  if (state.current === next) {
    return false;
  }
  return getNextResearchPhase(state.current) === next;
}

export function advancePhase(state: PhaseState, next: ResearchPhase): PhaseState {
  if (!canAdvancePhase(state, next)) {
    throw new Error(`非法阶段跳转: ${state.current} -> ${next}`);
  }
  return {
    current: next,
    completed: [...state.completed, state.current],
  };
}
