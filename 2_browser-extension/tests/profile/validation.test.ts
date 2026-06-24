import { hasAllMandatoryAnswers } from "../../src/profile/scoring";
import { BIG_FIVE_ITEMS } from "../../src/profile/items";
import { QuestionnaireAnswers } from "../../src/profile/types";

describe("hasAllMandatoryAnswers", () => {
  it("is false when a mandatory Big Five item is missing", () => {
    const answers: QuestionnaireAnswers = { bfi_o2: 3 };
    expect(hasAllMandatoryAnswers(answers)).toBe(false);
  });

  it("is true when every Big Five item is answered", () => {
    const answers: QuestionnaireAnswers = {};
    for (const item of BIG_FIVE_ITEMS) answers[item.id] = 3;
    expect(hasAllMandatoryAnswers(answers)).toBe(true);
  });
});
