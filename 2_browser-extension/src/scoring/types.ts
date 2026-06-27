// Risk Score & behaviour-tracking types (FR4).

export type RiskBand = "low" | "medium" | "high";

export type BehaviourEventType =
  // Score-raising signals (more vulnerable):
  | "SHARE_FLAGGED"
  | "LIKE_FLAGGED"
  | "DISMISS_INTERVENTION"
  | "SHORT_DWELL_WARNING"
  | "FAST_SCROLL"
  | "SHORT_DWELL_POST"
  // Score-lowering signals (more reflective):
  | "LONG_DWELL_POST"
  | "READ_EXPANDED_WARNING"
  | "CLICK_TRUSTED_SOURCE"
  | "TIME_ON_INTERVENTION";

export interface BehaviourEvent {
  type: BehaviourEventType;
  postId?: string;
  timestamp: number;
  /** Optional measured value, e.g. dwell time in ms or scroll speed. */
  value?: number;
}

/** Per-user risk state, persisted in chrome.storage. Updated continuously (learning loop). */
export interface RiskState {
  score: number; // 0–100
  updatedAt: number;
  eventCount: number;
  /** Rolling-window accounting for the passive-signal rate cap (see learning.ts). */
  passiveWindowStart?: number;
  passivePoints?: number;
}
