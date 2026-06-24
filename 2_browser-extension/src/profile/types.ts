// Personality profiling types (FR1, FR2).

export type TraitLevel = "low" | "medium" | "high";

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
  nfcc?: number;
}

export type PoliticalOrientation = "left" | "center" | "right";

/**
 * LLM-safe abstract profile: ONLY anonymized trait levels.
 * Political orientation is intentionally EXCLUDED here — by design it can never reach the
 * LLM, because the wording layer only ever receives a PersonalityProfile (FR6, §6).
 */
export interface PersonalityProfile {
  openness: TraitLevel;
  conscientiousness: TraitLevel;
  extraversion: TraitLevel;
  agreeableness: TraitLevel;
  neuroticism: TraitLevel;
  nfcc?: TraitLevel;
}
