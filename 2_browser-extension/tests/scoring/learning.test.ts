import { applyEvent, initialState } from "../../src/scoring/learning";
import { makeEvent } from "../../src/scoring/behaviour";

describe("learning loop", () => {
  it("raises the score when the user shares flagged content", () => {
    const next = applyEvent(initialState(50), makeEvent("SHARE_FLAGGED"));
    expect(next.score).toBe(70);
    expect(next.eventCount).toBe(1);
  });

  it("lowers the score when the user clicks a trusted source", () => {
    const next = applyEvent(initialState(50), makeEvent("CLICK_TRUSTED_SOURCE"));
    expect(next.score).toBe(38);
  });

  it("does not mutate the original state", () => {
    const state = initialState(50);
    applyEvent(state, makeEvent("SHARE_FLAGGED"));
    expect(state.score).toBe(50);
  });

  it("clamps the score at 100", () => {
    const next = applyEvent(initialState(95), makeEvent("SHARE_FLAGGED"));
    expect(next.score).toBe(100);
  });
});
