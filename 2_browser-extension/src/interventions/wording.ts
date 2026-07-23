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
const MAX_HEADLINE_LENGTH = 240;
const MAX_BODY_LENGTH = 1_200;
const T2_MAX_HEADLINE_WORDS = 6;
const T2_MAX_BODY_WORDS = 22;
// Prompting reduces stock wording; validating it makes the user-facing rule deterministic even
// when a model ignores an instruction. The caller then uses its claim-specific local fallback.
const BANNED_STOCK_PHRASES = [
  "a short pause may help",
  "a second perspective in brief",
  "worth a second look",
  "shared conversation",
  "the linked source has the fuller context",
];

function containsBannedStockPhrase(headline: string, body: string): boolean {
  const combined = `${headline} ${body}`.toLowerCase();
  return BANNED_STOCK_PHRASES.some((phrase) => combined.includes(phrase));
}

function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function containsUrlOrDomain(headline: string, body: string): boolean {
  const combined = `${headline} ${body}`;
  return /https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|org|net|edu|gov|io|co|de|uk)\b/i.test(combined);
}

/** Parse the LLM's JSON reply; fall back to a safe static message if it isn't valid JSON. */
export function parseWording(raw: string, tier?: Tier): InterventionText {
  try {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}") + 1;
    if (start < 0 || end <= start) throw new Error("no json object");
    const parsed = JSON.parse(raw.slice(start, end)) as Partial<InterventionText>;
    if (typeof parsed.headline !== "string" || typeof parsed.body !== "string") {
      throw new Error("wording fields must be strings");
    }
    const headline = parsed.headline.trim().slice(0, MAX_HEADLINE_LENGTH);
    if (!headline) throw new Error("empty headline");
    const body = parsed.body.trim().slice(0, MAX_BODY_LENGTH);
    if (containsBannedStockPhrase(headline, body) || containsUrlOrDomain(headline, body)) {
      throw new Error("disallowed wording");
    }
    if (
      tier === "T2" &&
      (wordCount(headline) > T2_MAX_HEADLINE_WORDS || wordCount(body) > T2_MAX_BODY_WORDS)
    ) {
      throw new Error("T2 wording exceeds its compact contract");
    }
    return { headline, body };
  } catch {
    return { headline: FALLBACK_HEADLINE, body: "" };
  }
}

/** True when parsing failed and the caller should use its own product-specific fallback text. */
export function isFallbackWording(text: InterventionText): boolean {
  return text.headline === FALLBACK_HEADLINE && text.body === "";
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
  return parseWording(raw, tier);
}
