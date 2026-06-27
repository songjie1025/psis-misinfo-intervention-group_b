import {
  bandFor,
  baselineFromProfile,
  clampScore,
} from "../../src/scoring/riskScore";
import { PersonalityProfile } from "../../src/profile/types";

const profile = (over: Partial<PersonalityProfile> = {}): PersonalityProfile => ({
  openness: "neutral",
  conscientiousness: "neutral",
  extraversion: "neutral",
  agreeableness: "neutral",
  neuroticism: "neutral",
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

describe("baselineFromProfile (Openness + Conscientiousness)", () => {
  it("keeps a neutral profile at the baseline", () => {
    expect(baselineFromProfile(profile())).toBe(50);
  });

  it("raises the baseline for low conscientiousness", () => {
    expect(baselineFromProfile(profile({ conscientiousness: "low" }))).toBe(60);
  });

  it("lowers the baseline for high conscientiousness", () => {
    expect(baselineFromProfile(profile({ conscientiousness: "high" }))).toBe(40);
  });

  it("applies the openness modifiers (low +5, high -5)", () => {
    expect(baselineFromProfile(profile({ openness: "low" }))).toBe(55);
    expect(baselineFromProfile(profile({ openness: "high" }))).toBe(45);
  });

  it("combines low openness + low conscientiousness", () => {
    expect(
      baselineFromProfile(profile({ openness: "low", conscientiousness: "low" })),
    ).toBe(65);
  });
});
