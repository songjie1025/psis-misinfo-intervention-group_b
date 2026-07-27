import {
  BLUE_SHIELD_ASSET,
  riskShieldForScore,
  TIER_SHIELD_ASSETS,
} from "../../src/ui/risk-shield";

describe("riskShieldForScore", () => {
  it("keeps the original blue shield below the T1 threshold", () => {
    expect(riskShieldForScore(null).assetPath).toBe(BLUE_SHIELD_ASSET);
    expect(riskShieldForScore(33).assetPath).toBe(BLUE_SHIELD_ASSET);
  });

  it("selects the labelled shield for each intervention tier", () => {
    expect(riskShieldForScore(34).assetPath).toBe(TIER_SHIELD_ASSETS.T1);
    expect(riskShieldForScore(56).assetPath).toBe(TIER_SHIELD_ASSETS.T2);
    expect(riskShieldForScore(78).assetPath).toBe(TIER_SHIELD_ASSETS.T3);
  });
});
