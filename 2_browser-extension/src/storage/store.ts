// Typed wrapper over chrome.storage.local. The ONLY module that touches storage directly.
import { STORAGE_KEYS } from "./keys";
import { ApiKeys, CachedWording } from "./schema";
import { PersonalityProfile, PoliticalOrientation } from "../profile/types";
import { RiskState } from "../scoring/types";
import { InteractionRecord } from "../dashboard/types";

// Keep the interaction log bounded: the dashboard's widest view is 1 month, so anything older
// than ~31 days is never shown and can be pruned on write.
const LOG_RETENTION_MS = 31 * 24 * 60 * 60 * 1000;
const MAX_SESSION_WORDINGS = 60;

async function get<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T) ?? null;
}

async function set(key: string, value: unknown): Promise<void> {
  await chrome.storage.local.set({ [key]: value });
}

async function getSession<T>(key: string): Promise<T | null> {
  const result = await chrome.storage.session.get(key);
  return (result[key] as T) ?? null;
}

async function setSession(key: string, value: unknown): Promise<void> {
  await chrome.storage.session.set({ [key]: value });
}

// Lightweight runtime guards: stored data from an older schema version must not
// silently pass as valid (e.g. a missing numeric score → NaN → wrong risk band).
const VALID_LEVELS = new Set<string>(["low", "neutral", "high"]);

function isProfile(v: unknown): v is PersonalityProfile {
  if (typeof v !== "object" || v === null) return false;
  const profile = v as PersonalityProfile;
  return [
    profile.openness,
    profile.conscientiousness,
    profile.extraversion,
    profile.agreeableness,
    profile.neuroticism,
  ].every((trait) => VALID_LEVELS.has(trait));
}

function isPolitical(v: unknown): v is PoliticalOrientation {
  return v === "left" || v === "right";
}

function isRiskState(v: unknown): v is RiskState {
  const reflectivePostIds =
    typeof v === "object" && v !== null
      ? (v as RiskState).reflectivePostIds
      : undefined;
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as RiskState).score === "number" &&
    Number.isFinite((v as RiskState).score) &&
    (reflectivePostIds === undefined ||
      (Array.isArray(reflectivePostIds) && reflectivePostIds.every((id) => typeof id === "string")))
  );
}

function isCachedWording(v: unknown): v is CachedWording {
  return (
    typeof v === "object" &&
    v !== null &&
    typeof (v as CachedWording).headline === "string" &&
    typeof (v as CachedWording).body === "string" &&
    typeof (v as CachedWording).cachedAt === "number" &&
    Number.isFinite((v as CachedWording).cachedAt) &&
    ((v as CachedWording).cacheEpoch === null || typeof (v as CachedWording).cacheEpoch === "string")
  );
}

async function getWordingCache(): Promise<Record<string, CachedWording>> {
  const raw = await getSession<unknown>(STORAGE_KEYS.wordingCache);
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw).filter((entry): entry is [string, CachedWording] => isCachedWording(entry[1])),
  );
}

export const store = {
  getProfile: async (): Promise<PersonalityProfile | null> => {
    const v = await get<unknown>(STORAGE_KEYS.profile);
    return isProfile(v) ? v : null;
  },
  setProfile: (p: PersonalityProfile) => set(STORAGE_KEYS.profile, p),

  getPolitical: async (): Promise<PoliticalOrientation | null> => {
    const v = await get<unknown>(STORAGE_KEYS.political);
    return isPolitical(v) ? v : null;
  },
  setPolitical: (p: PoliticalOrientation) => set(STORAGE_KEYS.political, p),

  getRiskState: async (): Promise<RiskState | null> => {
    const v = await get<unknown>(STORAGE_KEYS.riskState);
    return isRiskState(v) ? v : null;
  },
  setRiskState: (s: RiskState) => set(STORAGE_KEYS.riskState, s),

  getApiKeys: () => get<ApiKeys>(STORAGE_KEYS.apiKeys),
  setApiKeys: (k: ApiKeys) => set(STORAGE_KEYS.apiKeys, k),

  getCachedWording: async (key: string): Promise<CachedWording | null> => {
    const cache = await getWordingCache();
    const value = cache[key];
    const epoch = await store.getWordingCacheEpoch();
    return value?.cacheEpoch === epoch ? value : null;
  },
  setCachedWording: async (
    key: string,
    value: Omit<CachedWording, "cachedAt" | "cacheEpoch">,
    cacheEpoch: string | null,
  ): Promise<void> => {
    const cache = await getWordingCache();
    cache[key] = { ...value, cachedAt: Date.now(), cacheEpoch };
    const entries = Object.entries(cache)
      .sort(([, a], [, b]) => b.cachedAt - a.cachedAt)
      .slice(0, MAX_SESSION_WORDINGS);
    await setSession(STORAGE_KEYS.wordingCache, Object.fromEntries(entries));
  },
  getWordingCooldownUntil: async (): Promise<number> => {
    const value = await getSession<unknown>(STORAGE_KEYS.wordingCooldownUntil);
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  },
  setWordingCooldownUntil: (until: number) => setSession(STORAGE_KEYS.wordingCooldownUntil, until),
  getWordingNextAllowedAt: async (): Promise<number> => {
    const value = await getSession<unknown>(STORAGE_KEYS.wordingNextAllowedAt);
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  },
  setWordingNextAllowedAt: (until: number) => setSession(STORAGE_KEYS.wordingNextAllowedAt, until),
  getWordingCacheEpoch: async (): Promise<string | null> => {
    const value = await getSession<unknown>(STORAGE_KEYS.wordingCacheEpoch);
    return typeof value === "string" ? value : null;
  },

  /** Interaction dashboard log (append-only, auto-pruned to the last 31 days). */
  getInteractionLog: async (): Promise<InteractionRecord[]> => {
    const v = await get<unknown>(STORAGE_KEYS.interactionLog);
    return Array.isArray(v) ? (v as InteractionRecord[]) : [];
  },
  appendInteraction: async (rec: InteractionRecord): Promise<void> => {
    const v = await get<unknown>(STORAGE_KEYS.interactionLog);
    const log = Array.isArray(v) ? (v as InteractionRecord[]) : [];
    const cutoff = Date.now() - LOG_RETENTION_MS;
    log.push(rec);
    const pruned = log.filter((r) => r.t >= cutoff);
    await set(STORAGE_KEYS.interactionLog, pruned);
  },

  getOnboardingComplete: async (): Promise<boolean> =>
    (await get<boolean>(STORAGE_KEYS.onboardingComplete)) ?? false,
  setOnboardingComplete: (v: boolean) =>
    set(STORAGE_KEYS.onboardingComplete, v),

  /** Epoch ms until which quiz insertion is suppressed (0 = no cooldown active). Persisted so a
   *  page refresh doesn't immediately re-show a quiz the user just dismissed. */
  getQuizCooldownUntil: async (): Promise<number> => {
    const v = await get<number>(STORAGE_KEYS.quizCooldownUntil);
    return typeof v === "number" && Number.isFinite(v) ? v : 0;
  },
  setQuizCooldownUntil: (until: number) => set(STORAGE_KEYS.quizCooldownUntil, until),

  /** "Clear my data": wipe all X-Check local data (privacy reset). */
  clearAll: async (): Promise<void> => {
    await Promise.all([chrome.storage.local.clear(), chrome.storage.session.clear()]);
    // This non-personal marker makes any response started before the reset stale.
    await setSession(
      STORAGE_KEYS.wordingCacheEpoch,
      `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
  },
};
