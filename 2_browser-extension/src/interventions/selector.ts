// Intervention selection (FR5).
import { RiskBand } from "../scoring/types";
import { Tier } from "./types";

/**
 * FR5: the Risk Score band ALONE determines the intervention tier.
 * Personality must NOT influence the tier — it only shapes the wording (FR6).
 */
export function selectTier(band: RiskBand): Tier {
  switch (band) {
    case "low":
      return "T1";
    case "medium":
      return "T2";
    case "high":
      return "T3";
  }
}
