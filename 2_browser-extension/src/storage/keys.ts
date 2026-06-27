// All chrome.storage key names live here, in one place (§6 auditability).
export const STORAGE_KEYS = {
  onboardingComplete: "xcheck.onboardingComplete",
  profile: "xcheck.profile",
  political: "xcheck.political",
  riskState: "xcheck.riskState",
  apiKeys: "xcheck.apiKeys",
} as const;
