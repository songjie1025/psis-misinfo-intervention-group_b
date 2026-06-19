import { parseClaims, parseAlignmentResult } from "../../src/pipeline/parser";
import { Claim, FactCheck } from "../../src/pipeline/types";

const makeFactCheck = (text = "Some claim"): FactCheck => ({
  claimText: text,
  factCheckDate: "",
  source: {
    publisherName: "Reuters",
    publisherSite: "reuters.com",
    url: "https://reuters.com/1",
    articleTitle: "Fact check: 5G does not cause cancer",
    rating: "False",
  },
});

describe("parseClaims", () => {
  it("parses claims wrapped in brackets", () => {
    const result = parseClaims("[5G causes cancer | vaccines have microchips]");
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("5G causes cancer");
    expect(result[1].content).toBe("vaccines have microchips");
  });

  it("parses claims without brackets", () => {
    const result = parseClaims("claim one | claim two | claim three");
    expect(result).toHaveLength(3);
    expect(result[0].content).toBe("claim one");
  });

  it("trims whitespace from each claim", () => {
    const result = parseClaims("[  claim one  |  claim two  ]");
    expect(result[0].content).toBe("claim one");
    expect(result[1].content).toBe("claim two");
  });

  it("handles a single claim with brackets", () => {
    const result = parseClaims("[only one claim]");
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("only one claim");
  });

  it("handles a single claim without brackets", () => {
    const result = parseClaims("only one claim");
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("only one claim");
  });

  it("extracts claims ignoring text outside brackets", () => {
    const result = parseClaims(
      "Here are the claims: [claim one | claim two] as requested.",
    );
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe("claim one");
  });
});

describe("parseAlignmentResult", () => {
  const claim: Claim = { content: "5G causes cancer" };

  it("returns aligned sources for relevant verdicts", () => {
    const response = '[{"id": 0, "relevant": true, "verdict": "CONTRADICTED"}]';
    const result = parseAlignmentResult(response, claim, [makeFactCheck()]);
    expect(result.alignments).toHaveLength(1);
    expect(result.alignments[0].verdict).toBe("CONTRADICTED");
    expect(result.alignments[0].source.publisherName).toBe("Reuters");
  });

  it("filters out irrelevant verdicts", () => {
    const response =
      '[{"id": 0, "relevant": false, "verdict": "CONTRADICTED"}]';
    const result = parseAlignmentResult(response, claim, [makeFactCheck()]);
    expect(result.alignments).toHaveLength(0);
  });

  it("filters out out-of-bounds ids", () => {
    const response =
      '[{"id": 99, "relevant": true, "verdict": "CONTRADICTED"}]';
    const result = parseAlignmentResult(response, claim, [makeFactCheck()]);
    expect(result.alignments).toHaveLength(0);
  });

  it("handles mixed relevant and irrelevant verdicts", () => {
    const response = `[
      {"id": 0, "relevant": true,  "verdict": "CONTRADICTED"},
      {"id": 1, "relevant": false, "verdict": "MISLEADING"},
      {"id": 2, "relevant": true,  "verdict": "MISLEADING"}
    ]`;
    const factChecks = [makeFactCheck(), makeFactCheck(), makeFactCheck()];
    const result = parseAlignmentResult(response, claim, factChecks);
    expect(result.alignments).toHaveLength(2);
    expect(result.alignments[0].verdict).toBe("CONTRADICTED");
    expect(result.alignments[1].verdict).toBe("MISLEADING");
  });

  it("sets claim content on the result", () => {
    const response = '[{"id": 0, "relevant": true, "verdict": "CONTRADICTED"}]';
    const result = parseAlignmentResult(response, claim, [makeFactCheck()]);
    expect(result.claim).toBe("5G causes cancer");
  });

  it("handles LLM response with surrounding text before the JSON", () => {
    const response =
      'Here is my analysis:\n[{"id": 0, "relevant": true, "verdict": "CONTRADICTED"}]';
    const result = parseAlignmentResult(response, claim, [makeFactCheck()]);
    expect(result.alignments).toHaveLength(1);
  });

  it("returns empty alignments for empty verdicts array", () => {
    const response = "[]";
    const result = parseAlignmentResult(response, claim, [makeFactCheck()]);
    expect(result.alignments).toHaveLength(0);
  });
});
