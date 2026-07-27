import {
  PREWRITTEN_CORRECTIONS,
  prewrittenWordingFor,
} from "../../src/interventions/mockWording";
import { Verdict, VerdictLabel } from "../../src/pipeline/types";
import { PersonalityProfile } from "../../src/profile/types";

const profile: PersonalityProfile = {
  openness: "high",
  conscientiousness: "high",
  extraversion: "neutral",
  agreeableness: "high",
  neuroticism: "neutral",
};

const verdict: Verdict = {
  claim: { content: "Example claim" },
  label: VerdictLabel.FALSE,
  sources: [],
};

describe("pre-written T2/T3 fallback wording", () => {
  it("covers every one of the 50 actionable mock posts with non-repetitive claim-specific copy", () => {
    expect(Object.keys(PREWRITTEN_CORRECTIONS)).toHaveLength(50);
    const t2Headlines = new Set<string>();
    const t3Headlines = new Set<string>();
    for (let postId = 1; postId <= 50; postId++) {
      const correction = PREWRITTEN_CORRECTIONS[String(postId)];
      expect(correction).toBeTruthy();

      const t2 = prewrittenWordingFor(String(postId), "T2", verdict, profile, null);
      const t3 = prewrittenWordingFor(String(postId), "T3", verdict, profile, null);
      t2Headlines.add(t2.headline);
      t3Headlines.add(t3.headline);
      expect(t2.body).toBe(correction);
      expect(t3.body).toBe(correction);
      expect(t2.headline).not.toMatch(/false|misleading|warning/i);
      expect(t3.headline).not.toMatch(/false|misleading|warning/i);
      expect(`${t2.headline} ${t2.body}`).not.toMatch(
        /A short pause may help|A second perspective in brief|Worth a second look|shared conversation|linked source has the fuller context/i,
      );
    }
    expect(t2Headlines.size).toBe(50);
    expect(t3Headlines.size).toBe(50);
  });

  it("adapts the static framing to orientation without naming an ideology", () => {
    const left = prewrittenWordingFor("1", "T2", verdict, profile, "left");
    const right = prewrittenWordingFor("1", "T2", verdict, profile, "right");

    expect(left.headline).toContain("Context for");
    expect(right.headline).toContain("What the source says");
    expect(left.headline).not.toMatch(/left|right/i);
    expect(right.headline).not.toMatch(/left|right/i);
  });

  it("uses the local personality profile to change the static communication style", () => {
    const directProfile: PersonalityProfile = {
      ...profile,
      openness: "low",
      conscientiousness: "low",
      agreeableness: "low",
    };
    const exploratory = prewrittenWordingFor("1", "T2", verdict, profile, null);
    const direct = prewrittenWordingFor("1", "T2", verdict, directProfile, null);

    expect(exploratory.headline).toContain("Evidence on");
    expect(direct.headline).toContain("A detail about");
    expect(direct.headline).not.toMatch(/openness|agreeableness|conscientiousness/i);
  });
});
