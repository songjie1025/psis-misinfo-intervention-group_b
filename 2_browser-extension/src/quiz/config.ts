// Tunables for the quiz intervention. Kept isolated from the logic so cadence/behaviour can be
// changed without touching quizBank.ts / quiz-injector.ts.

/** Insert one quiz card into the feed after this many DISTINCT normal posts have been seen. */
export const QUIZ_POST_INTERVAL = 20;

/** After the user taps "Not interested", suppress new quiz insertions for this long (ms). */
export const QUIZ_COOLDOWN_DURATION_MS = 30 * 60 * 1000; // 30 minutes
