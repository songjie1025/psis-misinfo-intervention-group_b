import { selectTier } from "../../src/interventions/selector";

describe("selectTier (FR5: Risk band alone decides the tier)", () => {
  it("low → T1", () => expect(selectTier("low")).toBe("T1"));
  it("medium → T2", () => expect(selectTier("medium")).toBe("T2"));
  it("high → T3", () => expect(selectTier("high")).toBe("T3"));
});
