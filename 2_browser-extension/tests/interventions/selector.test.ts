import { tierForScore } from "../../src/interventions/selector";

describe("tierForScore (FR5: Risk Score alone decides the tier)", () => {
  it("no intervention at/below the floor (33)", () => {
    expect(tierForScore(0)).toBeNull();
    expect(tierForScore(33)).toBeNull();
  });

  it("maps score ranges to T1 / T2 / T3", () => {
    expect(tierForScore(34)).toBe("T1");
    expect(tierForScore(55)).toBe("T1");
    expect(tierForScore(56)).toBe("T2");
    expect(tierForScore(77)).toBe("T2");
    expect(tierForScore(78)).toBe("T3");
    expect(tierForScore(100)).toBe("T3");
  });
});
