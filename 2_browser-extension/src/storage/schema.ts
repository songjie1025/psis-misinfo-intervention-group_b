// Shapes of everything X-Check persists locally (§4, §6 local-first).
import { PersonalityProfile, PoliticalOrientation } from "../profile/types";
import { RiskState } from "../scoring/types";

/** BYOK: the user's own API keys, entered in the popup and stored locally (§6, §9). */
export interface ApiKeys {
  gemini: string;
  factCheck: string;
}

export interface StoredData {
  onboardingComplete: boolean;
  profile: PersonalityProfile | null;
  political: PoliticalOrientation | null; // raw value stays local; only a derived, ID-anonymised tone line reaches the LLM (FR6)
  riskState: RiskState | null;
  apiKeys: ApiKeys | null;
}
