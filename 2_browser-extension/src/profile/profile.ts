// Profile building (FR2): per-trait scores → abstract low/neutral/high labels.
import { PersonalityProfile, TraitLevel, TraitScores } from "./types";

// BFI-10 midpoint. Tolga's scoring: average < 3 = low trait, > 3 = high trait, exactly 3 = neutral.
export const MIDPOINT = 3;

export function toLevel(score: number): TraitLevel {
  if (score < MIDPOINT) return "low";
  if (score > MIDPOINT) return "high";
  return "neutral"; // exactly at the midpoint → no strong leaning
}

/** Collapse numeric trait scores into the abstract profile. */
export function buildProfile(scores: TraitScores): PersonalityProfile {
  return {
    openness: toLevel(scores.openness),
    conscientiousness: toLevel(scores.conscientiousness),
    extraversion: toLevel(scores.extraversion),
    agreeableness: toLevel(scores.agreeableness),
    neuroticism: toLevel(scores.neuroticism),
    ...(scores.nfcc !== undefined ? { nfcc: toLevel(scores.nfcc) } : {}), // unused in current version
  };
}
