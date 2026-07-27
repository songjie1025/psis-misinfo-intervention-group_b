import { createInterventionPrompt } from "../../src/interventions/prompts";
import { Verdict, VerdictLabel } from "../../src/pipeline/types";
import { PersonalityProfile } from "../../src/profile/types";

const profile: PersonalityProfile = {
  openness: "high",
  conscientiousness: "high",
  extraversion: "neutral",
  agreeableness: "low",
  neuroticism: "neutral",
};

const verdict: Verdict = {
  claim: { content: "A claim that needs claim-specific context." },
  label: VerdictLabel.FALSE,
  sources: [
    {
      publisherName: "Independent Review",
      publisherSite: "example.org",
      url: "https://example.org/review",
      articleTitle: "A source specific to this claim",
      rating: "FALSE",
    },
  ],
};

describe("Gemini intervention prompt", () => {
  it("includes local claim, source, personality and political tone without exposing labels", () => {
    const prompt = createInterventionPrompt("T2", verdict, profile, "right");

    expect(prompt).toContain("A claim that needs claim-specific context.");
    expect(prompt).toContain("Independent Review");
    expect(prompt).toContain("A source specific to this claim");
    expect(prompt).not.toContain("https://example.org/review");
    expect(prompt).toContain("personal judgment and freedom");
    expect(prompt).not.toMatch(/user is right-wing|political orientation is right/i);
  });

  it("requires short, low-reactance output", () => {
    const prompt = createInterventionPrompt("T3", verdict, profile, null);

    expect(prompt).toContain("body: 30–60 words");
    expect(prompt).toContain("low-reactance language");
    expect(prompt).toContain('Do not use the words "false"');
    expect(prompt).toContain("Both headline and body must refer to the concrete claim");
    expect(prompt).toContain('"A short pause may help"');
    expect(prompt).toContain("never output a URL, domain, markdown link");
  });

  it("makes T2 materially more compact than T3", () => {
    const t2 = createInterventionPrompt("T2", verdict, profile, null);
    const t3 = createInterventionPrompt("T3", verdict, profile, null);

    expect(t2).toContain("EXACTLY ONE factual correction sentence");
    expect(t2).toContain("body: max 22 words");
    expect(t3).toContain("TWO short correction sentences");
    expect(t3).toContain("body: 30–60 words");
  });
});
