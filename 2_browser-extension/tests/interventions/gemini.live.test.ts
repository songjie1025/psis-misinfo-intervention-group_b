// Opt-in smoke test: it is skipped unless a caller supplies its own key at runtime.
// No credential is read from files, code, or test output.
import { GeminiClient } from "../../src/pipeline/geminiClient";
import { FALLBACK_HEADLINE, generateWording } from "../../src/interventions/wording";
import { VerdictLabel } from "../../src/pipeline/types";

const runtimeEnv = (globalThis as unknown as {
  process?: { env?: Record<string, string | undefined> };
}).process?.env;
const apiKey = runtimeEnv?.GEMINI_API_KEY;
const liveDescribe = runtimeEnv?.RUN_LIVE_GEMINI_TEST === "1" && apiKey ? describe : describe.skip;

liveDescribe("live Gemini wording smoke test", () => {
  jest.setTimeout(20_000);

  it("returns structured T2 wording for a fixed mock verdict", async () => {
    const result = await generateWording(
      new GeminiClient(apiKey as string),
      "T2",
      {
        claim: { content: "A fabricated claim about a public-health policy." },
        label: VerdictLabel.FALSE,
        sources: [
          {
            publisherName: "Example Fact Check",
            publisherSite: "example.org",
            url: "https://example.org/fact-check",
            articleTitle: "Fixed mock source",
            rating: "FALSE",
          },
        ],
      },
      {
        openness: "neutral",
        conscientiousness: "neutral",
        extraversion: "neutral",
        agreeableness: "neutral",
        neuroticism: "neutral",
      },
      null,
    );

    expect(result.headline).not.toBe(FALLBACK_HEADLINE);
    expect(result.headline.length).toBeGreaterThan(0);
    expect(result.body.length).toBeGreaterThan(0);
  });
});
