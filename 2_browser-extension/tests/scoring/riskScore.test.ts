import {
  bandFor,
  baselineFromProfile,
  clampScore,
} from "../../src/scoring/riskScore";
import { PersonalityProfile } from "../../src/profile/types";

const profile = (over: Partial<PersonalityProfile> = {}): PersonalityProfile => ({
  openness: "medium",
  conscientiousness: "medium",
  extraversion: "medium",
  agreeableness: "medium",
  neuroticism: "medium",
  ...over,
});

describe("clampScore", () => {
  it("clamps to the 0–100 range", () => {
    expect(clampScore(-5)).toBe(0);
    expect(clampScore(150)).toBe(100);
    expect(clampScore(42)).toBe(42);
  });
});

describe("bandFor", () => {
  it("maps representative scores to bands", () => {
    expect(bandFor(10)).toBe("low");
    expect(bandFor(50)).toBe("medium");
    expect(bandFor(90)).toBe("high");
  });

  it("pins the exact band boundaries (drives which tier fires)", () => {
    expect(bandFor(33)).toBe("low");
    expect(bandFor(34)).toBe("medium");
    expect(bandFor(66)).toBe("medium");
    expect(bandFor(67)).toBe("high");
  });
});

describe("baselineFromProfile", () => {
  it("keeps a neutral profile at the baseline", () => {
    expect(baselineFromProfile(profile())).toBe(50);
  });

  it("raises the baseline for high need-for-closure", () => {
    expect(baselineFromProfile(profile({ nfcc: "high" }))).toBe(65);
  });

  it("applies the protective modifier for high openness", () => {
    expect(baselineFromProfile(profile({ openness: "high" }))).toBe(45);
  });

  it("combines susceptibility and protective modifiers", () => {
    // nfcc high (+15) and openness high (-5) → 60
    expect(baselineFromProfile(profile({ nfcc: "high", openness: "high" }))).toBe(60);
  });
});
