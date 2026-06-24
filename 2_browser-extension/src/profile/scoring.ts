// Questionnaire scoring (FR2): raw Likert answers → per-trait scores.
import { ALL_ITEMS, BIG_FIVE_ITEMS } from "./items";
import {
  AnswerValue,
  ItemTrait,
  QuestionnaireAnswers,
  QuestionnaireItem,
  TraitScores,
} from "./types";

export const LIKERT_MIN = 1;
export const LIKERT_MAX = 5;

/** Reverse-keyed items invert the Likert scale (1↔5, 2↔4, 3↔3). */
export function scoreItem(item: QuestionnaireItem, answer: AnswerValue): number {
  return item.reverse ? LIKERT_MIN + LIKERT_MAX - answer : answer;
}

/** All mandatory (Big Five) items must be answered before a profile can be built. */
export function hasAllMandatoryAnswers(answers: QuestionnaireAnswers): boolean {
  return BIG_FIVE_ITEMS.every((item) => answers[item.id] !== undefined);
}

/**
 * Average the (reverse-corrected) answers per trait. Traits with no answers are
 * omitted: nfcc is dropped if optional and unanswered; Big Five default to 0 if missing
 * (callers should gate on hasAllMandatoryAnswers first to avoid corrupt profiles).
 */
export function scoreAnswers(answers: QuestionnaireAnswers): TraitScores {
  const sums: Record<ItemTrait, { total: number; count: number }> = {
    openness: { total: 0, count: 0 },
    conscientiousness: { total: 0, count: 0 },
    extraversion: { total: 0, count: 0 },
    agreeableness: { total: 0, count: 0 },
    neuroticism: { total: 0, count: 0 },
    nfcc: { total: 0, count: 0 },
  };

  for (const item of ALL_ITEMS) {
    const answer = answers[item.id];
    if (answer === undefined) continue;
    sums[item.trait].total += scoreItem(item, answer);
    sums[item.trait].count += 1;
  }

  const avg = (trait: ItemTrait): number =>
    sums[trait].count > 0 ? sums[trait].total / sums[trait].count : 0;

  const scores: TraitScores = {
    openness: avg("openness"),
    conscientiousness: avg("conscientiousness"),
    extraversion: avg("extraversion"),
    agreeableness: avg("agreeableness"),
    neuroticism: avg("neuroticism"),
  };
  if (sums.nfcc.count > 0) scores.nfcc = avg("nfcc");
  return scores;
}
