// Questionnaire item bank (FR1). Data only — no logic.
import { QuestionnaireItem } from "./types";

// Big Five — BFI-10 (Rammstedt & John, 2007). MANDATORY. Two items per trait, one reverse-keyed.
export const BIG_FIVE_ITEMS: QuestionnaireItem[] = [
  { id: "bfi_e1", text: "I see myself as someone who is reserved.", trait: "extraversion", reverse: true, optional: false },
  { id: "bfi_e2", text: "I see myself as someone who is outgoing, sociable.", trait: "extraversion", reverse: false, optional: false },
  { id: "bfi_a1", text: "I see myself as someone who is generally trusting.", trait: "agreeableness", reverse: false, optional: false },
  { id: "bfi_a2", text: "I see myself as someone who tends to find fault with others.", trait: "agreeableness", reverse: true, optional: false },
  { id: "bfi_c1", text: "I see myself as someone who tends to be lazy.", trait: "conscientiousness", reverse: true, optional: false },
  { id: "bfi_c2", text: "I see myself as someone who does a thorough job.", trait: "conscientiousness", reverse: false, optional: false },
  { id: "bfi_n1", text: "I see myself as someone who is relaxed, handles stress well.", trait: "neuroticism", reverse: true, optional: false },
  { id: "bfi_n2", text: "I see myself as someone who gets nervous easily.", trait: "neuroticism", reverse: false, optional: false },
  { id: "bfi_o1", text: "I see myself as someone who has few artistic interests.", trait: "openness", reverse: true, optional: false },
  { id: "bfi_o2", text: "I see myself as someone who has an active imagination.", trait: "openness", reverse: false, optional: false },
];

// NFCC short scale — DROPPED for this version (2026-06-25 meeting). Kept here, but NOT part of
// ALL_ITEMS, so it is not asked. Re-add to ALL_ITEMS if NFCC is brought back later.
export const NFCC_ITEMS: QuestionnaireItem[] = [
  { id: "nfcc_1", text: "I don't like situations that are uncertain.", trait: "nfcc", reverse: false, optional: true },
  { id: "nfcc_2", text: "I dislike questions that can be answered in many different ways.", trait: "nfcc", reverse: false, optional: true },
  { id: "nfcc_3", text: "I find that a consistent routine lets me enjoy life more.", trait: "nfcc", reverse: false, optional: true },
  { id: "nfcc_4", text: "I feel uncomfortable when I don't understand why an event occurred.", trait: "nfcc", reverse: false, optional: true },
  { id: "nfcc_5", text: "I dislike it when someone's statement could mean many different things.", trait: "nfcc", reverse: false, optional: true },
];

// Current version asks the BFI-10 only (+ the optional political question below).
export const ALL_ITEMS: QuestionnaireItem[] = [...BIG_FIVE_ITEMS];

// Optional single-choice political-orientation question. left / right, or skipped (no-answer).
// NOTE: a finer-grained scale (strong vs. slight lean) is a planned future enhancement (REQUIREMENTS §9).
export const POLITICAL_QUESTION = {
  id: "political_orientation",
  text: "Politically, where would you place yourself? (optional)",
  options: ["left", "right"] as const,
  optional: true,
};
