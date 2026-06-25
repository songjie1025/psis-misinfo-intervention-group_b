// Generate tier-appropriate, personality-adapted wording via the LLM (FR6).
import { GeminiClient } from "../pipeline/geminiClient";
import { Verdict } from "../pipeline/types";
import { PersonalityProfile, PoliticalOrientation } from "../profile/types";
import { createInterventionPrompt } from "./prompts";
import { Tier } from "./types";

export interface InterventionText {
  headline: string;
  body: string;
}

// Shown when the LLM reply can't be parsed — never surface raw model output to the user.
export const FALLBACK_HEADLINE = "This post may contain misinformation.";

/** Parse the LLM's JSON reply; fall back to a safe static message if it isn't valid JSON. */
export function parseWording(raw: string): InterventionText {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}") + 1;
    if (start < 0 || end <= start) throw new Error("no json object");
    const parsed = JSON.parse(raw.slice(start, end)) as Partial<InterventionText>;
    return { headline: parsed.headline ?? FALLBACK_HEADLINE, body: parsed.body ?? "" };
  } catch {
    return { headline: FALLBACK_HEADLINE, body: "" };
  }
}

export async function generateWording(
  client: GeminiClient,
  tier: Tier,
  verdict: Verdict,
  profile: PersonalityProfile,
  political: PoliticalOrientation | null = null,
): Promise<InterventionText> {
  const prompt = createInterventionPrompt(tier, verdict, profile, political);
  const raw = await client.ask(prompt);
  return parseWording(raw);
}
