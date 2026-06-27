// Intervention selection (FR5): the Risk Score ALONE decides the tier — personality only
// shapes the wording (FR6). The tier is derived from the LIVE score on every check, so an
// intervention escalates / de-escalates / disappears as the user's behaviour moves the score.
import { Tier } from "./types";

// Tunable thresholds (REQUIREMENTS §9). At/below the floor the user is reflective enough that
// we show no warning at all.
export const NO_INTERVENTION_MAX = 33;
export const T1_MAX = 55;
export const T2_MAX = 77;

/** Risk score -> tier, or null when the score is at/below the no-intervention floor. */
export function tierForScore(score: number): Tier | null {
  if (score <= NO_INTERVENTION_MAX) return null;
  if (score <= T1_MAX) return "T1";
  if (score <= T2_MAX) return "T2";
  return "T3";
}
