// Types for the fake-post interaction dashboard (a "screen-time"-style reflection surface).
// The dashboard NEVER shows the numeric Risk Score (FR5/§6) — only behavioural counts.
import { BehaviourEventType } from "../scoring/types";

/** One logged interaction with a flagged/fake post. Persisted in chrome.storage.local. */
export interface InteractionRecord {
  /** Event timestamp (ms since epoch). */
  t: number;
  type: BehaviourEventType;
  /** The post the interaction relates to, when applicable. */
  postId?: string;
}

export type DashboardRange = "today" | "week" | "month";

/** Aggregated summary for one time window. */
export interface DashboardSummary {
  range: DashboardRange;
  /** How many flagged posts were shown an intervention — the shared denominator. */
  seen: number;
  /** Per-event-type counts (undo events already netted out). */
  byType: Record<string, number>;
}
