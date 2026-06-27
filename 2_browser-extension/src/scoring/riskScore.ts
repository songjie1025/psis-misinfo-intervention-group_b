// Risk Score calculation (FR4): baseline from personality + band thresholds.
import { PersonalityProfile } from "../profile/types";
import { RiskBand } from "./types";

export const SCORE_MIN = 0;
export const SCORE_MAX = 100;
export const NEUTRAL_BASELINE = 50;

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
 * Based on Openness + Conscientiousness (team decision, 2026-06-25). Lower openness /
 * conscientiousness → higher starting susceptibility.
 *
 * Weights: C uses ±10 (stronger research signal); O uses a smaller ±5 (weaker research signal).
 *
 * NOTE: Tolga's "Personality and Misinformation" review actually found Openness has no
 * effect on sharing, while Conscientiousness & Agreeableness (↓) and Extraversion (↑) do.
 * If we want to align baseline with that data, switch the factors to C/A/E. All weights
 * are tunable — see REQUIREMENTS §9.
 */
export function baselineFromProfile(profile: PersonalityProfile): number {
  let score = NEUTRAL_BASELINE;
  if (profile.conscientiousness === "low") score += 10;
  if (profile.openness === "low") score += 5;
  if (profile.conscientiousness === "high") score -= 10;
  if (profile.openness === "high") score -= 5;
  return clampScore(score);
}
