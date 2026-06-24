import { scoreItem, scoreAnswers } from "../../src/profile/scoring";
import { QuestionnaireAnswers, QuestionnaireItem } from "../../src/profile/types";

const item = (reverse: boolean): QuestionnaireItem => ({
  id: "x",
  text: "",
  trait: "openness",
  reverse,
  optional: false,
});

describe("scoreItem", () => {
  it("returns the raw answer for normal items", () => {
    expect(scoreItem(item(false), 4)).toBe(4);
  });

  it("inverts the scale for reverse-keyed items", () => {
    expect(scoreItem(item(true), 5)).toBe(1);
    expect(scoreItem(item(true), 1)).toBe(5);
  });
});

describe("scoreAnswers", () => {
  it("averages the two items of a Big Five trait (with reverse keying)", () => {
    // openness items: bfi_o1 (reverse), bfi_o2 (normal)
    const answers: QuestionnaireAnswers = { bfi_o1: 1, bfi_o2: 5 };
    // bfi_o1 reverse 1→5, bfi_o2 5 → average 5
    expect(scoreAnswers(answers).openness).toBe(5);
  });

  it("omits nfcc when the optional items are unanswered", () => {
    const answers: QuestionnaireAnswers = { bfi_o2: 3 };
    expect(scoreAnswers(answers).nfcc).toBeUndefined();
  });

  it("includes nfcc when answered", () => {
    const answers: QuestionnaireAnswers = { nfcc_1: 5, nfcc_2: 5 };
    expect(scoreAnswers(answers).nfcc).toBe(5);
  });
});
