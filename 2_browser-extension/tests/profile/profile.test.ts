import { buildProfile, toLevel } from "../../src/profile/profile";
import { TraitScores } from "../../src/profile/types";

describe("toLevel", () => {
  it("maps scores to low / neutral / high (midpoint 3)", () => {
    expect(toLevel(2)).toBe("low");
    expect(toLevel(3)).toBe("neutral");
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

  it("maps Big Five scores to levels", () => {
    expect(buildProfile(base).openness).toBe("high");
  });

  it("omits nfcc (not collected in the current version)", () => {
    expect(buildProfile(base).nfcc).toBeUndefined();
  });
});
