// All chrome.storage key names live here, in one place (§6 auditability).
export const STORAGE_KEYS = {
  onboardingComplete: "xcheck.onboardingComplete",
  profile: "xcheck.profile",
  political: "xcheck.political",
  riskState: "xcheck.riskState",
  apiKeys: "xcheck.apiKeys",
  interactionLog: "xcheck.interactionLog",
  // Session-only Gemini wording cache and rate-limit cooldown. Never stores an API key.
  wordingCache: "xcheck.wordingCache",
  wordingCooldownUntil: "xcheck.wordingCooldownUntil",
  wordingNextAllowedAt: "xcheck.wordingNextAllowedAt",
  // Changes after "Clear my data" so an older in-flight request cannot be reused as fresh data.
  wordingCacheEpoch: "xcheck.wordingCacheEpoch",
  // Epoch ms until which quiz cards are suppressed after the user taps "Not interested" (0 = no
  // active cooldown).
  quizCooldownUntil: "xcheck.quizCooldownUntil",
} as const;
