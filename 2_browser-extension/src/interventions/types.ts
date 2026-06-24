// Intervention types (FR5, FR6) — including the logic→front-end hand-off object.
import { VerdictLabel } from "../pipeline/types";
import { RiskBand } from "../scoring/types";

export type Tier = "T1" | "T2" | "T3";

export interface InterventionSource {
  publisherName: string;
  url: string;
  articleTitle: string;
}

/**
 * THE CONTRACT between the worker logic and the front-end DOM layer.
 * The front-end reads this object and nothing else. It must never receive personality
 * labels, raw answers, political values, or the numeric risk score (FR5, FR6, §6).
 */
export interface InterventionDecision {
  postId: string;
  /** false → the front-end renders nothing for this post. */
  shouldIntervene: boolean;
  /** Chosen by Risk Score ALONE (FR5). Drives which UI the front-end renders. */
  tier: Tier;
  verdictLabel: VerdictLabel;
  /** LLM-generated, personality-adapted (FR6). */
  headline: string;
  /** Body text; empty for T1. */
  body: string;
  /** Shown for T2/T3. */
  sources: InterventionSource[];
  /** For UI styling only — not the raw score. */
  riskBand: RiskBand;
}
