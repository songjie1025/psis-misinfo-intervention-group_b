import { parseClaims, parseAlignmentResult } from "../../src/pipeline/parser";
import { Claim } from "../../src/pipeline/types";

describe("parseClaims (robustness)", () => {
  it("returns [] for empty LLM output", () => {
    expect(parseClaims("")).toEqual([]);
    expect(parseClaims("[]")).toEqual([]);
  });

  it("filters out empty fragments", () => {
    expect(parseClaims("[a | | b]")).toEqual([
      { content: "a" },
      { content: "b" },
    ]);
  });
});

describe("parseAlignmentResult (robustness)", () => {
  const claim: Claim = { content: "c" };

  it("returns empty alignments on malformed JSON instead of throwing", () => {
    expect(parseAlignmentResult("not json at all", claim, [])).toEqual({
      claim: "c",
      alignments: [],
    });
  });
});
