import {
  applyEvent,
  hasRecordedReflectivePost,
  initialState,
  isPerPostReflectiveEvent,
  recordReflectivePost,
} from "../../src/scoring/learning";
import { makeEvent } from "../../src/scoring/behaviour";
import { BehaviourEvent, RiskState } from "../../src/scoring/types";

describe("learning loop", () => {
  it("raises the score when the user shares flagged content (+20)", () => {
    const next = applyEvent(initialState(50), makeEvent("SHARE_FLAGGED"));
    expect(next.score).toBe(70);
    expect(next.eventCount).toBe(1);
  });

  it("raises the score moderately when the user likes flagged content (+10)", () => {
    expect(applyEvent(initialState(50), makeEvent("LIKE_FLAGGED")).score).toBe(60);
  });

  it("applies a small +5 signal when the user dismisses an intervention", () => {
    expect(applyEvent(initialState(50), makeEvent("DISMISS_INTERVENTION")).score).toBe(55);
  });

  it("lowers the score when the user reads carefully (LONG_DWELL_POST, -3)", () => {
    expect(applyEvent(initialState(50), makeEvent("LONG_DWELL_POST")).score).toBe(47);
  });

  it("lowers the score when the user clicks a trusted source (-12)", () => {
    expect(applyEvent(initialState(50), makeEvent("CLICK_TRUSTED_SOURCE")).score).toBe(38);
  });

  it("rewards a correct quiz answer (-10) without adding any penalty event for other outcomes", () => {
    expect(applyEvent(initialState(50), makeEvent("QUIZ_CORRECT")).score).toBe(40);
  });

  it("records a warning/source reduction only once for the same post", () => {
    const event: BehaviourEvent = {
      type: "READ_EXPANDED_WARNING",
      postId: "post-1",
      timestamp: 1_000_000,
    };
    const state = recordReflectivePost(applyEvent(initialState(50), event), event.postId!);

    expect(isPerPostReflectiveEvent(event)).toBe(true);
    expect(hasRecordedReflectivePost(state, "post-1")).toBe(true);
    expect(hasRecordedReflectivePost(state, "post-2")).toBe(false);
  });

  it("does not mutate the original state", () => {
    const state = initialState(50);
    applyEvent(state, makeEvent("SHARE_FLAGGED"));
    expect(state.score).toBe(50);
  });

  it("clamps the score at 100", () => {
    expect(applyEvent(initialState(95), makeEvent("SHARE_FLAGGED")).score).toBe(100);
  });

  it("decays toward 50 over idle time and does not let passive scrolling raise a high score", () => {
    const state: RiskState = { score: 80, updatedAt: 1_000_000, eventCount: 0 };
    // 60s idle -> drift ~2 toward 50 (80->78); passive browsing cannot add above 55.
    const event: BehaviourEvent = { type: "FAST_SCROLL", timestamp: 1_060_000 };
    expect(applyEvent(state, event).score).toBe(78);
  });

  it("caps passive skim/scroll signals at the T1 ceiling", () => {
    const t0 = 1_000_000;
    let state: RiskState = { score: 50, updatedAt: t0, eventCount: 0 };
    // 15 short-dwell skims at the same instant cannot turn neutral browsing into T2/T3.
    for (let i = 0; i < 15; i++) {
      state = applyEvent(state, { type: "SHORT_DWELL_POST", timestamp: t0 });
    }
    expect(state.score).toBe(55);
    expect(state.passivePoints).toBe(5);
  });

  it("refills the passive budget after the 60s window", () => {
    const t0 = 1_000_000;
    let state: RiskState = { score: 50, updatedAt: t0, eventCount: 0 };
    for (let i = 0; i < 15; i++) {
      state = applyEvent(state, { type: "SHORT_DWELL_POST", timestamp: t0 });
    }
    expect(state.passivePoints).toBe(5); // T1 ceiling reached
    const after = applyEvent(state, { type: "SHORT_DWELL_POST", timestamp: t0 + 61_000 });
    expect(after.passivePoints).toBe(1); // window reset -> budget refilled, 1 drawn
  });

  it("does not cap deliberate actions (like/share are always full)", () => {
    const t0 = 1_000_000;
    let state: RiskState = { score: 50, updatedAt: t0, eventCount: 0 };
    // exhaust the passive budget first
    for (let i = 0; i < 15; i++) {
      state = applyEvent(state, { type: "SHORT_DWELL_POST", timestamp: t0 });
    }
    // a share still counts in full (+20) despite the passive budget being spent
    const after = applyEvent(state, { type: "SHARE_FLAGGED", timestamp: t0 });
    expect(after.score).toBe(75); // 55 + 20
  });
});
