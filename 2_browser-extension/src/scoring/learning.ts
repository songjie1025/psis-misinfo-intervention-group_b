// The learning loop (FR4): fold behaviour events into the Risk State over time.
import { EVENT_WEIGHTS } from "./behaviour";
import { clampScore } from "./riskScore";
import { BehaviourEvent, RiskState } from "./types";

export function initialState(baseline: number): RiskState {
  return { score: clampScore(baseline), updatedAt: Date.now(), eventCount: 0 };
}

/** Apply one behaviour event, returning a NEW RiskState (immutable update). */
export function applyEvent(state: RiskState, event: BehaviourEvent): RiskState {
  const delta = EVENT_WEIGHTS[event.type] ?? 0;
  return {
    score: clampScore(state.score + delta),
    updatedAt: event.timestamp,
    eventCount: state.eventCount + 1,
  };
}
