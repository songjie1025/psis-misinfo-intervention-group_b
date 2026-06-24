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
});
