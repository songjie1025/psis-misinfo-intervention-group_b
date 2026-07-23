import { PersonalityProfile } from "../../src/profile/types";
import {
  createWordingRequestCoordinator,
  shouldGenerateWording,
  wordingCacheKey,
} from "../../src/interventions/wordingCache";

const profile: PersonalityProfile = {
  openness: "neutral",
  conscientiousness: "neutral",
  extraversion: "neutral",
  agreeableness: "neutral",
  neuroticism: "neutral",
};

describe("Gemini wording cache coordination", () => {
  it("does not request Gemini for compact T1 or an absent key", () => {
    expect(shouldGenerateWording("T1", "key")).toBe(false);
    expect(shouldGenerateWording("T2", "")).toBe(false);
    expect(shouldGenerateWording("T3", "key")).toBe(true);
  });

  it("keys successful responses by content-relevant local context, not credentials", () => {
    const base = wordingCacheKey({ postId: "1", tier: "T2", profile, political: null });
    const differentTier = wordingCacheKey({ postId: "1", tier: "T3", profile, political: null });
    const differentPolitical = wordingCacheKey({ postId: "1", tier: "T2", profile, political: "left" });
    expect(base).not.toBe(differentTier);
    expect(base).not.toBe(differentPolitical);
    expect(base).not.toContain("key");
  });

  it("coalesces concurrent requests without retaining personal text in worker memory", async () => {
    const coordinator = createWordingRequestCoordinator();
    let calls = 0;
    const generate = async () => {
      calls += 1;
      return { headline: "Generated", body: "Explanation" };
    };
    const fallback = { headline: "Mock", body: "" };

    const [first, second] = await Promise.all([
      coordinator.resolve("same", fallback, generate),
      coordinator.resolve("same", fallback, generate),
    ]);
    const third = await coordinator.resolve("same", fallback, generate);

    // The persistent chrome.storage.session cache is owned by background.ts. This coordinator
    // intentionally keeps no completed-result map, so "Clear my data" has no worker-memory leak.
    expect(calls).toBe(2);
    expect(first).toEqual({ headline: "Generated", body: "Explanation" });
    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("does not cache a failed generation", async () => {
    const coordinator = createWordingRequestCoordinator();
    const fallback = { headline: "Mock", body: "" };
    let calls = 0;

    const failed = await coordinator.resolve("retry", fallback, async () => {
      calls += 1;
      throw new Error("transient");
    });
    const recovered = await coordinator.resolve("retry", fallback, async () => {
      calls += 1;
      return { headline: "Recovered", body: "" };
    });

    expect(failed).toEqual(fallback);
    expect(recovered.headline).toBe("Recovered");
    expect(calls).toBe(2);
  });
});
