// LLM prompt builders for personality-adapted intervention wording (FR6).
import { Verdict } from "../pipeline/types";
import { PersonalityProfile } from "../profile/types";
import { Tier } from "./types";

/** Only abstract, anonymized labels — never raw answers, identity, or political values (§6). */
function personalityHint(profile: PersonalityProfile): string {
  const parts = [
    `openness=${profile.openness}`,
    `conscientiousness=${profile.conscientiousness}`,
    `extraversion=${profile.extraversion}`,
    `agreeableness=${profile.agreeableness}`,
    `neuroticism=${profile.neuroticism}`,
  ];
  if (profile.nfcc) parts.push(`need-for-closure=${profile.nfcc}`);
  return parts.join(", ");
}

const TIER_INSTRUCTION: Record<Tier, string> = {
  T1: "Write a SINGLE short warning label (max 12 words). Set body to an empty string.",
  T2: "Write a short headline plus a 2–3 sentence justification that references the sources.",
  T3: "Write a firm but respectful full-screen interruption: a headline plus 3–4 sentences explaining why this matters before the user continues.",
};

export function createInterventionPrompt(
  tier: Tier,
  verdict: Verdict,
  profile: PersonalityProfile,
): string {
  const sources =
    verdict.sources
      .map((s) => `- ${s.publisherName}: ${s.articleTitle} (${s.url})`)
      .join("\n") || "(none)";

  return `You are X-Check, a misinformation-intervention assistant.
A social-media claim has been fact-checked.

Claim: "${verdict.claim.content}"
Verdict: ${verdict.label}
Sources:
${sources}

Adapt the TONE and WORDING to this user's personality profile: ${personalityHint(profile)}.
${TIER_INSTRUCTION[tier]}

Return ONLY a JSON object: {"headline": "...", "body": "..."} and nothing else.`;
}
