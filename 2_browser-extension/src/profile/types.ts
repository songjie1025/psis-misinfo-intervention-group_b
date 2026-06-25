// Personality profiling types (FR1, FR2).

// Two-band model with a neutral midpoint, aligned with the BFI-10 scoring in Tolga's research:
// trait average < 3 = low, > 3 = high, exactly 3 = neutral.
export type TraitLevel = "low" | "neutral" | "high";

export type BigFiveTrait =
  | "openness"
  | "conscientiousness"
  | "extraversion"
  | "agreeableness"
  | "neuroticism";

/** Likert 1–5 answer. */
export type AnswerValue = 1 | 2 | 3 | 4 | 5;

export type ItemTrait = BigFiveTrait | "nfcc";

export interface QuestionnaireItem {
  id: string;
  text: string;
  trait: ItemTrait;
  reverse: boolean;
  optional: boolean;
}

export type QuestionnaireAnswers = Record<string, AnswerValue>;

export interface TraitScores {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
  // NFCC is NOT collected in the current version (dropped at the 2026-06-25 meeting).
  // Field kept optional so the code path is reversible if NFCC is re-added later.
  nfcc?: number;
}

// Political orientation: left / right (no-answer = the value is simply absent).
// The finer-grained scale (strong vs. slight lean) is a future enhancement — see REQUIREMENTS §9.
export type PoliticalOrientation = "left" | "right";

/**
 * Abstract personality profile = Big Five trait levels only.
 * Political orientation is handled SEPARATELY (passed alongside this profile to the prompt
 * layer). It MAY now be used to adapt prompts: user identity is protected by ID-anonymisation
 * of requests, so sending tone guidance derived from it does not expose who the user is.
 */
export interface PersonalityProfile {
  openness: TraitLevel;
  conscientiousness: TraitLevel;
  extraversion: TraitLevel;
  agreeableness: TraitLevel;
  neuroticism: TraitLevel;
  nfcc?: TraitLevel; // unused in current version (see note on TraitScores)
}
