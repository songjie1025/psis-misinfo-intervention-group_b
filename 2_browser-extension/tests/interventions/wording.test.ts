import { parseWording, FALLBACK_HEADLINE } from "../../src/interventions/wording";

describe("parseWording", () => {
  it("parses a valid JSON reply", () => {
    expect(parseWording('{"headline":"H","body":"B"}')).toEqual({
      headline: "H",
      body: "B",
    });
  });

  it("extracts JSON embedded in surrounding text", () => {
    expect(parseWording('Sure: {"headline":"H","body":""} done').headline).toBe(
      "H",
    );
  });

  it("falls back to a safe static headline on non-JSON output", () => {
    const result = parseWording("I'm sorry, I cannot help with that.");
    expect(result.headline).toBe(FALLBACK_HEADLINE);
    expect(result.body).toBe("");
  });

  it("rejects incomplete or wrongly typed JSON fields", () => {
    expect(parseWording('{"headline":"H"}').headline).toBe(FALLBACK_HEADLINE);
    expect(parseWording('{"headline":3,"body":"B"}').headline).toBe(FALLBACK_HEADLINE);
    expect(parseWording('{"headline":" ","body":"B"}').headline).toBe(FALLBACK_HEADLINE);
  });

  it("rejects old generic intervention phrases so the post-specific fallback is used", () => {
    const result = parseWording(
      JSON.stringify({
        headline: "A short pause may help.",
        body: "A second perspective in brief may help keep a shared conversation grounded.",
      }),
    );

    expect(result).toEqual({ headline: FALLBACK_HEADLINE, body: "" });
  });

  it("rejects a URL or domain in a generated intervention", () => {
    const result = parseWording(
      JSON.stringify({
        headline: "Evidence on this claim",
        body: "More detail is available at https://example.org/review.",
      }),
      "T3",
    );

    expect(result).toEqual({ headline: FALLBACK_HEADLINE, body: "" });
  });

  it("rejects an overlong T2 reply and leaves its compact fallback to the caller", () => {
    const result = parseWording(
      JSON.stringify({
        headline: "A notably long headline about this claim",
        body: "This deliberately exceeds the compact T2 contract by adding too many words for a single brief correction sentence here.",
      }),
      "T2",
    );

    expect(result).toEqual({ headline: FALLBACK_HEADLINE, body: "" });
  });

  it("bounds accepted model text before handing it to the renderer", () => {
    const result = parseWording(
      JSON.stringify({ headline: "h".repeat(300), body: "b".repeat(1400) }),
    );
    expect(result.headline).toHaveLength(240);
    expect(result.body).toHaveLength(1200);
  });
});
