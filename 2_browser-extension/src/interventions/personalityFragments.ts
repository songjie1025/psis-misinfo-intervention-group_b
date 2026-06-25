// Personality-adapted prompt fragments (FR6) — derived from Tolga's research framework.
//
// HOW THE PROMPT IS ASSEMBLED (see prompts.ts):
//   role + claim/verdict/sources
//     + [Openness line] + [Agreeableness line] + [Conscientiousness line]
//     + [political line, optional]
//     + tier instruction
//
// WEIGHTING / EACH DIMENSION'S ROLE:
//   There is no numeric weight — every selected line is concatenated with EQUAL emphasis and
//   the LLM blends them. The dimensions play DISTINCT roles, so they don't conflict:
//     • Openness          → WHAT to surface: invite exploration (high) vs. embed the justification (low).
//     • Agreeableness     → the MOTIVATIONAL angle: protect the community (high) vs. empathy for the harmed (low).
//     • Conscientiousness → FORM & trust: cite independent review (high) vs. ultra-short & visual (low).
//   Extraversion & Neuroticism are NOT used — research found no effect on label attitudes.
//   Political orientation adds ONE optional line, only when the user answered it.
//
// Each line is intentionally ONE short sentence so the assembled prompt stays compact.
// The high/low lines come from Tolga's "Labels for Personality…" framework; the `neutral`
// lines are balanced defaults we added for users sitting exactly at the midpoint (score == 3).
import {
  BigFiveTrait,
  PersonalityProfile,
  PoliticalOrientation,
  TraitLevel,
} from "../profile/types";

type Fragments = Record<TraitLevel, string>;

const OPENNESS: Fragments = {
  high: "The user is open to new ideas — frame the warning as an invitation to explore independent, alternative perspectives rather than a restriction.",
  low: "The user rarely researches on their own — state the key justification and facts directly inside the message.",
  neutral: "Keep the framing balanced: briefly note the claim is disputed and point to the verification.",
};

const AGREEABLENESS: Fragments = {
  high: "The user is prosocial — emphasise how relying on accurate information protects the community and other people.",
  low: "The user is more skeptical — use empathy: show how this misinformation can harm vulnerable people.",
  neutral: "Keep a neutral, respectful, matter-of-fact tone.",
};

const CONSCIENTIOUSNESS: Fragments = {
  high: "The user values order and accuracy — state transparently that the verdict comes from an independent, third-party fact-check.",
  low: "The user prefers brevity — be extremely short and visual: a few words, no dense text.",
  neutral: "Use a clear, standard explanation of moderate length.",
};

// Only the three dimensions the research shows affect label attitudes, in assembly order.
const DIMENSIONS: { trait: BigFiveTrait; fragments: Fragments }[] = [
  { trait: "openness", fragments: OPENNESS },
  { trait: "agreeableness", fragments: AGREEABLENESS },
  { trait: "conscientiousness", fragments: CONSCIENTIOUSNESS },
];

const POLITICAL: Record<PoliticalOrientation, string> = {
  left: "Frame accuracy as a way to protect the community and shared well-being.",
  right: "Use a non-preachy tone, stress the independence of the source, and appeal to personal judgment and freedom.",
};

/** The three personality tone lines (Openness, Agreeableness, Conscientiousness) for this profile. */
export function personalityFragments(profile: PersonalityProfile): string[] {
  return DIMENSIONS.map((d) => d.fragments[profile[d.trait]]);
}

/** Optional political tone line; empty when the user did not answer the political question. */
export function politicalFragment(political: PoliticalOrientation | null): string[] {
  return political ? [POLITICAL[political]] : [];
}
