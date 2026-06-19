import {
  extractClaimsFromPost,
  alignFactChecksWithClaim,
  generateVerdict,
  generatePostVerdict,
  generateLlmExplanation,
} from "../../src/pipeline/pipeline";
import { GeminiClient } from "../../src/pipeline/geminiClient";
import { FactCheckDbClient } from "../../src/pipeline/googleClient";
import {
  Claim,
  AlignmentResult,
  Post,
  FactCheck,
  Source,
} from "../../src/pipeline/types";

const geminiClient = new GeminiClient("");
const factCheckClient = new FactCheckDbClient("");

const makeSource = (): Source => ({
  publisherName: "Reuters",
  publisherSite: "reuters.com",
  url: "https://reuters.com/1",
  articleTitle: "Fact check: 5G does not cause cancer",
  rating: "False",
});

const makeFactCheck = (text = "5G causes cancer"): FactCheck => ({
  claimText: text,
  factCheckDate: "2024-01-01",
  source: makeSource(),
});

describe("extractClaimsFromPost", () => {
  it("extracts multiple claims from a post", async () => {
    jest
      .spyOn(geminiClient, "ask")
      .mockResolvedValue("[5G causes cancer | vaccines contain microchips]");

    const post: Post = {
      content: "5G causes cancer. Vaccines contain microchips.",
    };
    const claims = await extractClaimsFromPost(geminiClient, post);

    expect(claims).toHaveLength(2);
    expect(claims[0].content).toBe("5G causes cancer");
    expect(claims[1].content).toBe("vaccines contain microchips");
  });

  it("handles a single claim", async () => {
    jest.spyOn(geminiClient, "ask").mockResolvedValue("[5G causes cancer]");

    const post: Post = { content: "5G causes cancer." };
    const claims = await extractClaimsFromPost(geminiClient, post);

    expect(claims).toHaveLength(1);
    expect(claims[0].content).toBe("5G causes cancer");
  });
});

describe("alignFactChecksWithClaim", () => {
  const claim: Claim = { content: "5G causes cancer" };

  it("returns alignment result for relevant fact checks", async () => {
    jest
      .spyOn(geminiClient, "ask")
      .mockResolvedValue(
        '[{"id": 0, "relevant": true, "verdict": "CONTRADICTED"}]',
      );

    const result = await alignFactChecksWithClaim(geminiClient, claim, [
      makeFactCheck(),
    ]);

    expect(result.claim).toBe("5G causes cancer");
    expect(result.alignments).toHaveLength(1);
    expect(result.alignments[0].verdict).toBe("CONTRADICTED");
  });

  it("throws when no fact checks are provided", async () => {
    await expect(
      alignFactChecksWithClaim(geminiClient, claim, []),
    ).rejects.toThrow("No fact checks provided.");
  });
});

describe("generateVerdict", () => {
  const claim: Claim = { content: "5G causes cancer" };

  it("returns FALSE when all verdicts are CONTRADICTED", () => {
    const alignment: AlignmentResult = {
      claim: claim.content,
      alignments: [{ source: makeSource(), verdict: "CONTRADICTED" }],
    };
    expect(generateVerdict(claim, alignment).label).toBe("FALSE");
  });

  it("returns MISLEADING when all verdicts are MISLEADING", () => {
    const alignment: AlignmentResult = {
      claim: claim.content,
      alignments: [{ source: makeSource(), verdict: "MISLEADING" }],
    };
    expect(generateVerdict(claim, alignment).label).toBe("MISLEADING");
  });

  it("returns DISPUTED when verdicts are mixed", () => {
    const alignment: AlignmentResult = {
      claim: claim.content,
      alignments: [
        { source: makeSource(), verdict: "CONTRADICTED" },
        { source: makeSource(), verdict: "MISLEADING" },
      ],
    };
    expect(generateVerdict(claim, alignment).label).toBe("DISPUTED");
  });

  it("returns UNVERIFIED when there are no alignments", () => {
    const alignment: AlignmentResult = { claim: claim.content, alignments: [] };
    expect(generateVerdict(claim, alignment).label).toBe("UNVERIFIED");
  });

  it("returns UNVERIFIED when all verdicts are UNVERIFIED", () => {
    const alignment: AlignmentResult = {
      claim: claim.content,
      alignments: [{ source: makeSource(), verdict: "UNVERIFIED" }],
    };
    expect(generateVerdict(claim, alignment).label).toBe("UNVERIFIED");
  });

  it("attaches the correct sources to the verdict", () => {
    const source = makeSource();
    const alignment: AlignmentResult = {
      claim: claim.content,
      alignments: [{ source, verdict: "CONTRADICTED" }],
    };
    expect(generateVerdict(claim, alignment).sources).toEqual([source]);
  });
});

describe("generatePostVerdict", () => {
  const post: Post = { content: "5G causes cancer." };
  const claim: Claim = { content: "5G causes cancer" };

  it("skips claims with no fact checks", async () => {
    jest.spyOn(factCheckClient, "getFactChecks").mockResolvedValue([]);

    const result = await generatePostVerdict(
      geminiClient,
      factCheckClient,
      post,
      [claim],
    );

    expect(result.verdicts).toHaveLength(0);
  });

  it("produces a verdict for claims with fact checks", async () => {
    jest
      .spyOn(factCheckClient, "getFactChecks")
      .mockResolvedValue([makeFactCheck()]);
    jest
      .spyOn(geminiClient, "ask")
      .mockResolvedValue(
        '[{"id": 0, "relevant": true, "verdict": "CONTRADICTED"}]',
      );

    const result = await generatePostVerdict(
      geminiClient,
      factCheckClient,
      post,
      [claim],
    );

    expect(result.verdicts).toHaveLength(1);
    expect(result.verdicts[0].label).toBe("FALSE");
  });

  it("attaches the original post to the result", async () => {
    jest.spyOn(factCheckClient, "getFactChecks").mockResolvedValue([]);

    const result = await generatePostVerdict(
      geminiClient,
      factCheckClient,
      post,
      [],
    );

    expect(result.post).toEqual(post);
  });
});

describe("generateLlmExplanation", () => {
  it("returns the LLM response as a string", async () => {
    jest
      .spyOn(geminiClient, "ask")
      .mockResolvedValue("This post contains misinformation about 5G.");

    const postVerdict = {
      post: { content: "5G causes cancer." },
      verdicts: [],
    };

    const result = await generateLlmExplanation(geminiClient, postVerdict);
    expect(result).toBe("This post contains misinformation about 5G.");
  });
});
