import { aggregate, rangeStart } from "../../src/dashboard/stats";
import { InteractionRecord } from "../../src/dashboard/types";
import { BehaviourEventType } from "../../src/scoring/types";

const DAY = 86_400_000;
// Fixed local reference time so day-bucketing is deterministic.
const NOW = new Date(2026, 6, 14, 12, 0, 0).getTime(); // 14 Jul 2026, 12:00 local

function rec(type: BehaviourEventType, t: number): InteractionRecord {
  return { type, t };
}

describe("dashboard aggregate", () => {
  it("counts FAKE_POST_SEEN as the shared denominator, not an action", () => {
    const s = aggregate([rec("FAKE_POST_SEEN", NOW), rec("FAKE_POST_SEEN", NOW)], "today", NOW);
    expect(s.seen).toBe(2);
    expect(s.byType.FAKE_POST_SEEN).toBeUndefined();
  });

  it("tallies each deliberate action by type", () => {
    const records = [
      rec("FAKE_POST_SEEN", NOW),
      rec("FAKE_POST_SEEN", NOW),
      rec("LIKE_FLAGGED", NOW),
      rec("SHARE_FLAGGED", NOW),
      rec("CLICK_TRUSTED_SOURCE", NOW),
    ];
    const s = aggregate(records, "today", NOW);
    expect(s.seen).toBe(2);
    expect(s.byType.LIKE_FLAGGED).toBe(1);
    expect(s.byType.SHARE_FLAGGED).toBe(1);
    expect(s.byType.CLICK_TRUSTED_SOURCE).toBe(1);
  });

  it("nets an undo event against its matching action", () => {
    const s = aggregate([rec("LIKE_FLAGGED", NOW), rec("UNLIKE_FLAGGED", NOW)], "today", NOW);
    expect(s.byType.LIKE_FLAGGED ?? 0).toBe(0);
  });

  it("excludes records outside the selected window", () => {
    const tenDaysAgo = NOW - 10 * DAY;
    const records = [rec("FAKE_POST_SEEN", tenDaysAgo), rec("SHARE_FLAGGED", tenDaysAgo)];
    const week = aggregate(records, "week", NOW);
    expect(week.seen).toBe(0);
    expect(week.byType.SHARE_FLAGGED ?? 0).toBe(0);
    const month = aggregate(records, "month", NOW);
    expect(month.seen).toBe(1);
    expect(month.byType.SHARE_FLAGGED).toBe(1);
  });

  it("rangeStart is local midnight for today and N days back for week/month", () => {
    expect(rangeStart("today", NOW)).toBe(new Date(2026, 6, 14, 0, 0, 0).getTime());
    expect(rangeStart("week", NOW)).toBe(new Date(2026, 6, 8, 0, 0, 0).getTime());
    expect(rangeStart("month", NOW)).toBe(new Date(2026, 5, 15, 0, 0, 0).getTime());
  });
});
