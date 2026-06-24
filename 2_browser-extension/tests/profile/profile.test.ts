import { buildProfile, toLevel } from "../../src/profile/profile";
import { TraitScores } from "../../src/profile/types";

describe("toLevel", () => {
  it("maps scores to low / medium / high", () => {
    expect(toLevel(2)).toBe("low");
    expect(toLevel(3)).toBe("medium");
    expect(toLevel(4.5)).toBe("high");
  });
});

describe("buildProfile", () => {
  const base: TraitScores = {
    openness: 4,
    conscientiousness: 4,
    extraversion: 4,
    agreeableness: 4,
    neuroticism: 4,
  };

  it("omits nfcc when absent", () => {
    expect(buildProfile(base).nfcc).toBeUndefined();
  });

  it("includes nfcc when present", () => {
    expect(buildProfile({ ...base, nfcc: 5 }).nfcc).toBe("high");
  });
});
