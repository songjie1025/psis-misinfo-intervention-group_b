// LLM prompt builder for personality-adapted intervention wording (FR6).
// Assembles a compact prompt from modular fragments — see personalityFragments.ts for the
// per-dimension roles and assembly logic.
import { Verdict } from "../pipeline/types";
import { PersonalityProfile, PoliticalOrientation } from "../profile/types";
import { personalityFragments, politicalFragment } from "./personalityFragments";
import { Tier } from "./types";

const TIER_INSTRUCTION: Record<Tier, string> = {
  T1: "Write a SINGLE short warning label (max 12 words). Set body to an empty string.",
  T2: "Write a short headline plus a 2–3 sentence justification that references the sources.",
  T3: "Write a firm but respectful full-screen interruption: a headline plus 3–4 sentences explaining why this matters before the user continues.",
};

export function createInterventionPrompt(
  tier: Tier,
  verdict: Verdict,
  profile: PersonalityProfile,
  political: PoliticalOrientation | null = null,
): string {
  const sources =
    verdict.sources
      .map((s) => `- ${s.publisherName}: ${s.articleTitle} (${s.url})`)
      .join("\n") || "(none)";

  // Strip newlines and quotes from scraped text to prevent prompt injection attacks.
  const safeClaim = verdict.claim.content.replace(/[\r\n]+/g, " ").replace(/"/g, "'").slice(0, 200);

  // One tone line per dimension (O, A, C) + an optional political line.
  const guidance = [
    ...personalityFragments(profile),
    ...politicalFragment(political),
  ]
    .map((line) => `- ${line}`)
    .join("\n");

  return `You are X-Check, a misinformation-intervention assistant.
A social-media claim has been fact-checked.

Claim: "${safeClaim}"
Verdict: ${verdict.label}
Sources:
${sources}

Tailor the tone and wording to this user (combine all of the following):
${guidance}

${TIER_INSTRUCTION[tier]}

Return ONLY a JSON object: {"headline": "...", "body": "..."} and nothing else.`;
}
