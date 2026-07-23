// Session-scoped wording coordination: successful results are persisted by storage/store.ts,
// while this module prevents concurrent duplicate calls and serialises distinct Gemini requests.
import { PersonalityProfile, PoliticalOrientation } from "../profile/types";
import { DEFAULT_GEMINI_MODEL } from "../pipeline/geminiClient";
import { Tier } from "./types";
import { InterventionText } from "./wording";

// Bump whenever the prompt's safety/tone contract changes so an old session result cannot be
// shown under a new wording policy.
const PROMPT_VERSION = "v4";

export function wordingCacheKey(params: {
  postId: string;
  tier: Tier;
  profile: PersonalityProfile;
  political: PoliticalOrientation | null;
}): string {
  const { postId, tier, profile, political } = params;
  // Explicit order avoids object-serialization ordering bugs and intentionally excludes API keys.
  return [
    "wording",
    PROMPT_VERSION,
    DEFAULT_GEMINI_MODEL,
    postId,
    tier,
    profile.openness,
    profile.conscientiousness,
    profile.extraversion,
    profile.agreeableness,
    profile.neuroticism,
    political ?? "none",
  ].join("|");
}

export function shouldGenerateWording(tier: Tier, geminiKey: unknown): geminiKey is string {
  // T1 deliberately stays static: its current UI never renders headline/body, so an LLM call
  // would cost quota without changing what the user sees.
  return tier !== "T1" && typeof geminiKey === "string" && geminiKey.trim().length > 0;
}

export interface WordingRequestCoordinator {
  resolve(
    key: string,
    fallback: InterventionText,
    generate: () => Promise<InterventionText | null>,
  ): Promise<InterventionText>;
}

export function createWordingRequestCoordinator(): WordingRequestCoordinator {
  const inFlight = new Map<string, Promise<InterventionText>>();
  let queue: Promise<void> = Promise.resolve();

  return {
    resolve(key, fallback, generate) {
      const existing = inFlight.get(key);
      if (existing) return existing;

      // A single worker-wide queue avoids a burst of different post requests on initial scan.
      const scheduled = queue.then(generate, generate);
      queue = scheduled.then(
        () => undefined,
        () => undefined,
      );
      const pending = scheduled.then((text) => text ?? fallback, () => fallback);
      inFlight.set(key, pending);
      void pending.then(
        () => inFlight.delete(key),
        () => inFlight.delete(key),
      );
      return pending;
    },
  };
}
