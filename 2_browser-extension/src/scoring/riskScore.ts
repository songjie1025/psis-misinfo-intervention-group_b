// Risk Score calculation (FR4): baseline from personality + band thresholds.
import { PersonalityProfile } from "../profile/types";
import { RiskBand } from "./types";

export const SCORE_MIN = 0;
export const SCORE_MAX = 100;
export const NEUTRAL_BASELINE = 50;
// Ambient browsing alone must never escalate someone beyond the compact T1 experience.
// This deliberately matches the current T1 ceiling in interventions/selector.ts.
export const PASSIVE_SCORE_CEILING = 55;

// Band cut-points. These map to intervention tiers in interventions/selector.ts.
export const LOW_BAND_MAX = 33;
export const MEDIUM_BAND_MAX = 66;

export function clampScore(score: number): number {
  return Math.max(SCORE_MIN, Math.min(SCORE_MAX, score));
}

export function bandFor(score: number): RiskBand {
  if (score <= LOW_BAND_MAX) return "low";
  if (score <= MEDIUM_BAND_MAX) return "medium";
  return "high";
}

/**
 * Starting Risk Score derived from the personality profile, before any behaviour.
 * Based on Conscientiousness, Agreeableness, and Extraversion (C/A/E). This is a deliberately
 * small prior, not a diagnosis: the questionnaire alone can only place a new user in 45–55.
 *
 * The repository's literature review reports lower sharing for C/A and higher sharing for E.
 * C receives the largest adjustment (±3); A and E receive small adjustments (±1 each) because
 * we have no calibrated effect sizes for this product.
 *
 * Openness no longer affects the Risk Score baseline; it remains available for wording.
 * All weights are tunable — see REQUIREMENTS §9.
 */
export function baselineFromProfile(profile: PersonalityProfile): number {
  let score = NEUTRAL_BASELINE;
  if (profile.conscientiousness === "low") score += 3;
  if (profile.conscientiousness === "high") score -= 3;
  if (profile.agreeableness === "low") score += 1;
  if (profile.agreeableness === "high") score -= 1;
  if (profile.extraversion === "high") score += 1;
  if (profile.extraversion === "low") score -= 1;
  return clampScore(score);
}
