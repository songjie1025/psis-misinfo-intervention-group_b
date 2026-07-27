// Pure aggregation for the interaction dashboard. No DOM, no storage — fully unit-testable.
// Every deliberate action is reported as a raw per-type count; the UI shows it as a share of the
// "seen" total (the shared denominator). No blended score is computed (behavioural only, FR5/§6).
import { BehaviourEventType } from "../scoring/types";
import { DashboardRange, DashboardSummary, InteractionRecord } from "./types";

const DAY_MS = 86_400_000;

// Undo events cancel the matching action so a toggled-off like nets to zero.
const UNDO: Partial<Record<BehaviourEventType, BehaviourEventType>> = {
  UNLIKE_FLAGGED: "LIKE_FLAGGED",
  UNSHARE_FLAGGED: "SHARE_FLAGGED",
};

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Inclusive lower bound (local midnight) of a range. today=1 day, week=7, month=30. */
export function rangeStart(range: DashboardRange, now: number): number {
  const today0 = startOfDay(now);
  if (range === "today") return today0;
  if (range === "week") return today0 - 6 * DAY_MS;
  return today0 - 29 * DAY_MS;
}

/** Aggregate raw records into per-type counts + the "seen" denominator for one window. */
export function aggregate(
  records: InteractionRecord[],
  range: DashboardRange,
  now: number,
): DashboardSummary {
  const start = rangeStart(range, now);
  const byType: Record<string, number> = {};
  let seen = 0;

  for (const r of records) {
    if (r.t < start || r.t > now) continue;

    if (r.type === "FAKE_POST_SEEN") {
      seen++;
      continue;
    }

    const undone = UNDO[r.type];
    if (undone) {
      byType[undone] = Math.max(0, (byType[undone] ?? 0) - 1);
      continue;
    }

    byType[r.type] = (byType[r.type] ?? 0) + 1;
  }

  return { range, seen, byType };
}
