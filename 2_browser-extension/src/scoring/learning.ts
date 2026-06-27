// The learning loop (FR4): fold behaviour events into the Risk State over time.
import { EVENT_WEIGHTS } from "./behaviour";
import { clampScore, NEUTRAL_BASELINE } from "./riskScore";
import { BehaviourEvent, BehaviourEventType, RiskState } from "./types";

// Slight time decay: the score drifts back toward neutral (50) while the user is idle,
// so it can recover and isn't a one-way ratchet. ~2 points per 60 seconds.
export const DECAY_PER_MS = 2 / 60000;

// Passive ("ambient browsing") signals are rate-limited so frantic scrolling to find a
// source can't snowball the score: together they may add at most PASSIVE_CAP_PER_WINDOW
// points per rolling 60s window. Deliberate actions (like/share/dismiss) are NOT capped —
// they always count in full. Tunable, see REQUIREMENTS §9.
export const PASSIVE_CAP_PER_WINDOW = 10;
export const PASSIVE_WINDOW_MS = 60_000;
const PASSIVE_TYPES: ReadonlySet<BehaviourEventType> = new Set([
  "SHORT_DWELL_POST",
  "SHORT_DWELL_WARNING",
  "FAST_SCROLL",
]);

/** Move `score` toward `target` by at most `amount`, never overshooting. */
function driftToward(score: number, target: number, amount: number): number {
  if (score > target) return Math.max(target, score - amount);
  if (score < target) return Math.min(target, score + amount);
  return score;
}

export function initialState(baseline: number): RiskState {
  return { score: clampScore(baseline), updatedAt: Date.now(), eventCount: 0 };
}

/** Apply one behaviour event, returning a NEW RiskState (immutable update). */
export function applyEvent(state: RiskState, event: BehaviourEvent): RiskState {
  const elapsedMs = Math.max(0, event.timestamp - state.updatedAt);
  const decayed = driftToward(state.score, NEUTRAL_BASELINE, elapsedMs * DECAY_PER_MS);
  const rawDelta = EVENT_WEIGHTS[event.type] ?? 0;

  // Carry the rolling passive budget forward across all events; only passive-positive
  // signals draw from it. The window resets once 60s have elapsed since it opened.
  let windowStart = state.passiveWindowStart ?? event.timestamp;
  let passivePoints = state.passivePoints ?? 0;
  let delta = rawDelta;
  if (PASSIVE_TYPES.has(event.type) && rawDelta > 0) {
    if (event.timestamp - windowStart >= PASSIVE_WINDOW_MS) {
      windowStart = event.timestamp; // window expired -> refill the budget
      passivePoints = 0;
    }
    const allowed = Math.max(0, PASSIVE_CAP_PER_WINDOW - passivePoints);
    delta = Math.min(rawDelta, allowed);
    passivePoints += delta;
  }

  return {
    score: clampScore(decayed + delta),
    updatedAt: event.timestamp,
    eventCount: state.eventCount + 1,
    passiveWindowStart: windowStart,
    passivePoints,
  };
}
