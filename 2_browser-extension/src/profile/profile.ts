// Profile building (FR2): per-trait scores → abstract high/medium/low labels.
import { PersonalityProfile, TraitLevel, TraitScores } from "./types";

// Likert midpoints. < 2.5 = low, < 3.5 = medium, otherwise high. Tunable (§9).
export const LOW_THRESHOLD = 2.5;
export const HIGH_THRESHOLD = 3.5;

export function toLevel(score: number): TraitLevel {
  if (score < LOW_THRESHOLD) return "low";
  if (score < HIGH_THRESHOLD) return "medium";
  return "high";
}

/** Collapse numeric trait scores into the LLM-safe abstract profile. */
export function buildProfile(scores: TraitScores): PersonalityProfile {
  const profile: PersonalityProfile = {
    openness: toLevel(scores.openness),
    conscientiousness: toLevel(scores.conscientiousness),
    extraversion: toLevel(scores.extraversion),
    agreeableness: toLevel(scores.agreeableness),
    neuroticism: toLevel(scores.neuroticism),
  };
  if (scores.nfcc !== undefined) profile.nfcc = toLevel(scores.nfcc);
  return profile;
}
