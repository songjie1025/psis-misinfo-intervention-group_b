import {
  buildDecision,
  isActionable,
  pickPrimaryVerdict,
} from "../../src/interventions/decision";
import { PostVerdict, Source, VerdictLabel } from "../../src/pipeline/types";

const src: Source = {
  publisherName: "Reuters",
  publisherSite: "reuters.com",
  url: "https://reuters.com/1",
  articleTitle: "Fact check",
  rating: "False",
};

describe("pickPrimaryVerdict", () => {
  it("returns the most severe verdict in a post", () => {
    const pv: PostVerdict = {
      post: { content: "p" },
      verdicts: [
        { claim: { content: "a" }, label: VerdictLabel.MISLEADING, sources: [src] },
        { claim: { content: "b" }, label: VerdictLabel.FALSE, sources: [src] },
      ],
    };
    expect(pickPrimaryVerdict(pv)?.label).toBe(VerdictLabel.FALSE);
  });

  it("returns null for a post with no verdicts", () => {
    expect(
      pickPrimaryVerdict({ post: { content: "p" }, verdicts: [] }),
    ).toBeNull();
  });
});

describe("isActionable", () => {
  it("treats UNVERIFIED as not actionable", () => {
    expect(isActionable(VerdictLabel.UNVERIFIED)).toBe(false);
    expect(isActionable(VerdictLabel.FALSE)).toBe(true);
  });
});

describe("buildDecision", () => {
  it("sets shouldIntervene=false for a null verdict", () => {
    const d = buildDecision({
      postId: "1",
      verdict: null,
      tier: "T1",
      band: "low",
      headline: "",
      body: "",
    });
    expect(d.shouldIntervene).toBe(false);
  });

  it("includes sources and text for an actionable verdict", () => {
    const verdict = {
      claim: { content: "a" },
      label: VerdictLabel.FALSE,
      sources: [src],
    };
    const d = buildDecision({
      postId: "1",
      verdict,
      tier: "T2",
      band: "medium",
      headline: "H",
      body: "B",
    });
    expect(d.shouldIntervene).toBe(true);
    expect(d.headline).toBe("H");
    expect(d.sources).toHaveLength(1);
    expect(d.sources[0].publisherName).toBe("Reuters");
  });
});
