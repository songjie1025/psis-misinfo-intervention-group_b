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

describe("baselineFromProfile (Conscientiousness + Agreeableness + Extraversion)", () => {
  it("keeps a neutral profile at the baseline", () => {
    expect(baselineFromProfile(profile())).toBe(50);
  });

  it("uses conscientiousness as the largest baseline adjustment", () => {
    expect(baselineFromProfile(profile({ conscientiousness: "low" }))).toBe(53);
    expect(baselineFromProfile(profile({ conscientiousness: "high" }))).toBe(47);
  });

  it("treats agreeableness as protective when high", () => {
    expect(baselineFromProfile(profile({ agreeableness: "low" }))).toBe(51);
    expect(baselineFromProfile(profile({ agreeableness: "high" }))).toBe(49);
  });

  it("treats extraversion as a small positive sharing-risk signal", () => {
    expect(baselineFromProfile(profile({ extraversion: "high" }))).toBe(51);
    expect(baselineFromProfile(profile({ extraversion: "low" }))).toBe(49);
  });

  it("does not use openness for the baseline", () => {
    expect(baselineFromProfile(profile({ openness: "low" }))).toBe(50);
    expect(baselineFromProfile(profile({ openness: "high" }))).toBe(50);
  });

  it("keeps the full personality-only range within 45–55", () => {
    expect(
      baselineFromProfile(profile({ conscientiousness: "low", agreeableness: "low", extraversion: "high" })),
    ).toBe(55);
    expect(
      baselineFromProfile(profile({ conscientiousness: "high", agreeableness: "high", extraversion: "low" })),
    ).toBe(45);
  });
});
