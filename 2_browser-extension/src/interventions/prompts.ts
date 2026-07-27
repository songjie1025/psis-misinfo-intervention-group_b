// LLM prompt builder for personality-adapted intervention wording (FR6).
// Assembles a compact prompt from modular fragments — see personalityFragments.ts for the
// per-dimension roles and assembly logic.
import { Verdict } from "../pipeline/types";
import { PersonalityProfile, PoliticalOrientation } from "../profile/types";
import { personalityFragments, politicalFragment } from "./personalityFragments";
import { Tier } from "./types";

const TIER_INSTRUCTION: Record<Tier, string> = {
  T1: "Write a SINGLE gentle context cue (max 8 words). Set body to an empty string.",
  T2: "Write a claim-specific headline (max 6 words) plus EXACTLY ONE factual correction sentence (body: max 22 words). Omit introductions, implications and conclusions.",
  T3: "Write a claim-specific headline (max 8 words) plus TWO short correction sentences (body: 30–60 words). Use the second sentence for one claim-specific nuance or missing context; stay calm, not confrontational.",
};

const LOW_REACTANCE_STYLE = `Use low-reactance language: invite a second look rather than issuing a warning.
Do not use the words "false", "misinformation", "debunked", "warning", or "share". Do not command, shame,
or diagnose the user. Never mention, infer, or name the user's personality or political orientation. Do not take
a political side. Keep the claim-specific correction accurate. Sources are rendered as separate clickable
elements in the interface: never output a URL, domain, markdown link, or an instruction to visit a source.
Both headline and body must refer to the concrete claim, subject, evidence, or correction. Do not use generic
stock wording, including "A short pause may help", "A second perspective in brief", "Worth a second look",
"shared conversation", or "The linked source has the fuller context". Do not add a generic preamble; use the
limited space for the post-specific correction.`;

export function createInterventionPrompt(
  tier: Tier,
  verdict: Verdict,
  profile: PersonalityProfile,
  political: PoliticalOrientation | null = null,
): string {
  const sources =
    verdict.sources
      .slice(0, 3)
      // URLs are unnecessary for wording generation and can tempt a model to repeat one. The
      // renderer owns the actual clickable source link outside the generated copy.
      .map((s) => `- ${s.publisherName}: ${s.articleTitle}`)
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

${LOW_REACTANCE_STYLE}

Return ONLY a JSON object: {"headline": "...", "body": "..."} and nothing else.`;
}
