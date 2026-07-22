// Pure quiz logic (no chrome.* / DOM), kept separate from quizBank.ts so it's directly
// unit-testable (see tests/quiz/logic.test.ts), matching the project convention of testing pure
// logic (scoring/stats/decision) under tests/.

/** Same shape as Math.random: () => a float in [0, 1). Injectable for deterministic tests. */
export type RandomFn = () => number;

/** Fisher–Yates shuffle. Returns a NEW array; never mutates the input. */
export function shuffle<T>(items: readonly T[], rng: RandomFn = Math.random): T[] {
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pick one random element from a non-empty array. */
export function pickRandom<T>(items: readonly T[], rng: RandomFn = Math.random): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * Build the shuffled multiple-choice options for a quiz: the correct FLICC technique plus up to 4
 * random distractors drawn from the other known techniques, in random order every time.
 *
 * Always returns exactly 5 options when at least 5 distinct techniques are available (the normal
 * case for quiz_questions.json). If the bank has fewer than 5 distinct techniques, it returns as
 * many as exist (correct + all available distractors) rather than padding with duplicates.
 */
export function buildOptions(
  correct: string,
  allTechniques: readonly string[],
  rng: RandomFn = Math.random,
): string[] {
  const distractorPool = shuffle(
    allTechniques.filter((t) => t !== correct),
    rng,
  );
  const distractors = distractorPool.slice(0, 4);
  return shuffle([correct, ...distractors], rng);
}
