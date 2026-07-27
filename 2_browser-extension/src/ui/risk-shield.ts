// Maps the live Risk Score to the floating shield asset. The numeric score remains private;
// the shield communicates only the current intervention level.
import { tierForScore } from "../interventions/selector";
import { Tier } from "../interventions/types";

export const BLUE_SHIELD_ASSET = "shield.png";
export const TIER_SHIELD_ASSETS: Record<Tier, string> = {
  T1: "shield-t1-low-risk.png",
  T2: "shield-t2-medium-risk.png",
  T3: "shield-t3-high-risk.png",
};

export const SHIELD_ASSET_PATHS = [
  BLUE_SHIELD_ASSET,
  TIER_SHIELD_ASSETS.T1,
  TIER_SHIELD_ASSETS.T2,
  TIER_SHIELD_ASSETS.T3,
] as const;

export interface RiskShield {
  assetPath: string;
  label: string;
}

const BLUE_SHIELD: RiskShield = {
  assetPath: BLUE_SHIELD_ASSET,
  label: "X-Check",
};

const TIER_SHIELDS: Record<Tier, RiskShield> = {
  T1: { assetPath: TIER_SHIELD_ASSETS.T1, label: "X-Check — Low risk (T1)" },
  T2: { assetPath: TIER_SHIELD_ASSETS.T2, label: "X-Check — Medium risk (T2)" },
  T3: { assetPath: TIER_SHIELD_ASSETS.T3, label: "X-Check — High risk (T3)" },
};

/** Returns the shield that represents the live intervention tier, never the numeric score. */
export function riskShieldForScore(score: number | null | undefined): RiskShield {
  if (typeof score !== "number" || !Number.isFinite(score)) return BLUE_SHIELD;
  const tier = tierForScore(score);
  return tier === null ? BLUE_SHIELD : TIER_SHIELDS[tier];
}
