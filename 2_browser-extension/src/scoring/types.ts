// Risk Score & behaviour-tracking types (FR4).

export type RiskBand = "low" | "medium" | "high";

export type BehaviourEventType =
  // Score-raising signals (more vulnerable):
  | "SHARE_FLAGGED"
  | "LIKE_FLAGGED"
  | "DISMISS_INTERVENTION"
  | "FAST_SCROLL"
  | "SHORT_DWELL_POST"
  // Score-lowering signals (more reflective):
  | "LONG_DWELL_POST"
  | "READ_EXPANDED_WARNING"
  | "CLICK_TRUSTED_SOURCE"
  // Educational quiz: only a correct answer is a reflective signal. Wrong/skipped answers do
  // not emit any event, so they can never penalise the user.
  | "QUIZ_CORRECT"
  // Undo signals: un-liking / un-sharing a flagged post reverses the earlier raise, so a
  // like that is toggled off nets to zero (see behaviour-tracker.ts).
  | "UNLIKE_FLAGGED"
  | "UNSHARE_FLAGGED"
  // Impression signal for the interaction dashboard ONLY: a flagged post was shown an
  // intervention. Carries zero score weight — it never moves the Risk Score.
  | "FAKE_POST_SEEN";

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
  /** Posts that have already earned their single warning/source-click reduction. Kept locally so
   * a refresh or React re-render cannot turn the same post into another score reduction. */
  reflectivePostIds?: string[];
}
