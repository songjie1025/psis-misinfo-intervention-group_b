// Typed wrapper over chrome.storage.local. The ONLY module that touches storage directly.
import { STORAGE_KEYS } from "./keys";
import { ApiKeys } from "./schema";
import { PersonalityProfile, PoliticalOrientation } from "../profile/types";
import { RiskState } from "../scoring/types";

async function get<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T) ?? null;
}

async function set(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

// Lightweight runtime guards: stored data from an older schema version must not
// silently pass as valid (e.g. a missing numeric score → NaN → wrong risk band).
function isProfile(v: unknown): v is PersonalityProfile {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as PersonalityProfile).openness === "string"
  );
}

function isRiskState(v: unknown): v is RiskState {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as RiskState).score === "number" &&
    Number.isFinite((v as RiskState).score)
  );
}

export const store = {
  getProfile: async (): Promise<PersonalityProfile | null> => {
    const v = await get<unknown>(STORAGE_KEYS.profile);
    return isProfile(v) ? v : null;
  },
  setProfile: (p: PersonalityProfile) => set(STORAGE_KEYS.profile, p),

  getPolitical: () => get<PoliticalOrientation>(STORAGE_KEYS.political),
  setPolitical: (p: PoliticalOrientation) => set(STORAGE_KEYS.political, p),

  getRiskState: async (): Promise<RiskState | null> => {
    const v = await get<unknown>(STORAGE_KEYS.riskState);
    return isRiskState(v) ? v : null;
  },
  setRiskState: (s: RiskState) => set(STORAGE_KEYS.riskState, s),

  getApiKeys: () => get<ApiKeys>(STORAGE_KEYS.apiKeys),
  setApiKeys: (k: ApiKeys) => set(STORAGE_KEYS.apiKeys, k),

  getOnboardingComplete: async (): Promise<boolean> =>
    (await get<boolean>(STORAGE_KEYS.onboardingComplete)) ?? false,
  setOnboardingComplete: (v: boolean) =>
    set(STORAGE_KEYS.onboardingComplete, v),

  /** "Clear my data": wipe all X-Check local data (privacy reset). */
  clearAll: (): Promise<void> => chrome.storage.local.clear(),
};
