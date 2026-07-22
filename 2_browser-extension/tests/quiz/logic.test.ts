import { buildOptions, pickRandom, shuffle } from "../../src/quiz/logic";

// Small deterministic PRNG so shuffle/buildOptions tests don't depend on Math.random.
function mulberry32(seed: number) {
  let t = seed;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

describe("shuffle", () => {
  it("returns a new array containing exactly the original elements", () => {
    const input = [1, 2, 3, 4, 5];
    const result = shuffle(input, mulberry32(1));
    expect(result).not.toBe(input);
    expect([...result].sort()).toEqual([...input].sort());
  });

  it("does not mutate the input array", () => {
    const input = [1, 2, 3, 4, 5];
    const copy = [...input];
    shuffle(input, mulberry32(2));
    expect(input).toEqual(copy);
  });

  it("is deterministic for a given rng sequence", () => {
    expect(shuffle([1, 2, 3, 4, 5], mulberry32(42))).toEqual(
      shuffle([1, 2, 3, 4, 5], mulberry32(42)),
    );
  });

  it("produces different orders for different rng seeds (sanity check)", () => {
    const a = shuffle([1, 2, 3, 4, 5, 6, 7, 8], mulberry32(1));
    const b = shuffle([1, 2, 3, 4, 5, 6, 7, 8], mulberry32(99));
    expect(a).not.toEqual(b);
  });
});

describe("pickRandom", () => {
  it("always returns an element from the array", () => {
    const arr = ["x", "y", "z"];
    for (let seed = 0; seed < 20; seed++) {
      expect(arr).toContain(pickRandom(arr, mulberry32(seed)));
    }
  });
});

describe("buildOptions (FLICC technique multiple choice)", () => {
  const ALL_TECHNIQUES = [
    "Cherry Picking",
    "Conspiracy Theories",
    "Fake Experts",
    "Impossible Expectations",
    "Logical Fallacies",
  ];

  it("always includes the correct answer", () => {
    for (let seed = 0; seed < 10; seed++) {
      const options = buildOptions("Impossible Expectations", ALL_TECHNIQUES, mulberry32(seed));
      expect(options).toContain("Impossible Expectations");
    }
  });

  it("returns exactly 5 unique options when >= 5 techniques are available", () => {
    const options = buildOptions("Fake Experts", ALL_TECHNIQUES, mulberry32(7));
    expect(options).toHaveLength(5);
    expect(new Set(options).size).toBe(5);
  });

  it("includes every available technique when exactly 5 exist (correct + all 4 distractors)", () => {
    const options = buildOptions("Cherry Picking", ALL_TECHNIQUES, mulberry32(3));
    expect([...options].sort()).toEqual([...ALL_TECHNIQUES].sort());
  });

  it("shuffles the option order across calls", () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 15; seed++) {
      orders.add(buildOptions("Logical Fallacies", ALL_TECHNIQUES, mulberry32(seed)).join("|"));
    }
    expect(orders.size).toBeGreaterThan(1);
  });

  it("caps distractors at 4 even with a larger technique pool", () => {
    const bigPool = [...ALL_TECHNIQUES, "Strawman", "False Dichotomy", "Ad Hominem"];
    const options = buildOptions("Strawman", bigPool, mulberry32(5));
    expect(options).toHaveLength(5);
    expect(options).toContain("Strawman");
  });

  it("degrades gracefully with fewer than 5 available techniques", () => {
    const smallPool = ["A", "B", "C"];
    const options = buildOptions("A", smallPool, mulberry32(1));
    expect(options).toHaveLength(3);
    expect([...options].sort()).toEqual(["A", "B", "C"]);
  });
});
