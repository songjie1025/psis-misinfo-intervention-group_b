// All chrome.storage key names live here, in one place (§6 auditability).
export const STORAGE_KEYS = {
  onboardingComplete: "xcheck.onboardingComplete",
  profile: "xcheck.profile",
  political: "xcheck.political",
  riskState: "xcheck.riskState",
  apiKeys: "xcheck.apiKeys",
  interactionLog: "xcheck.interactionLog",
  // Epoch ms until which quiz cards are suppressed after the user taps "Not interested" (0 = no
  // active cooldown).
  quizCooldownUntil: "xcheck.quizCooldownUntil",
} as const;
