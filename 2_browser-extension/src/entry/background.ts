// X-Check service worker — the orchestrator.
// Caches the (expensive) fact-check VERDICT per post, but derives the intervention tier and
// wording from the LIVE Risk Score on every check, so interventions follow the score (FR4/FR5).
import { onWorkerRequest } from "../messaging/bridge";
import {
  CheckPostRequest,
  WorkerRequest,
  WorkerResponse,
} from "../messaging/messages";
import { factCheck } from "../pipeline/pipeline";
import { GeminiClient } from "../pipeline/geminiClient";
import { FactCheckDbClient } from "../pipeline/googleClient";
import { Verdict } from "../pipeline/types";
import { store } from "../storage/store";
import { bandFor, baselineFromProfile } from "../scoring/riskScore";
import { applyEvent, initialState } from "../scoring/learning";
import { RiskState } from "../scoring/types";
import { PersonalityProfile } from "../profile/types";
import { tierForScore } from "../interventions/selector";
import {
  buildDecision,
  isActionable,
  pickPrimaryVerdict,
} from "../interventions/decision";
import { generateWording, InterventionText } from "../interventions/wording";

const DEFAULT_BASELINE = 50;

const NEUTRAL_PROFILE: PersonalityProfile = {
  openness: "neutral",
  conscientiousness: "neutral",
  extraversion: "neutral",
  agreeableness: "neutral",
  neuroticism: "neutral",
};

// Cache the VERDICT per post text (null = checked, no actionable verdict). This is the
// expensive part (Gemini extract/align + Google Fact Check) and never changes for a post.
const verdictCache = new Map<string, Verdict | null>();
// Cache wording per `${content}|${tier}` so Gemini is only called when the tier actually changes.
const wordingCache = new Map<string, InterventionText>();

console.info("[X-Check] service worker loaded");

async function getOrInitRiskState(
  profile: PersonalityProfile | null,
): Promise<RiskState> {
  const existing = await store.getRiskState();
  if (existing) return existing;
  const baseline = profile ? baselineFromProfile(profile) : DEFAULT_BASELINE;
  const state = initialState(baseline);
  await store.setRiskState(state);
  return state;
}

async function handleCheckPost(req: CheckPostRequest): Promise<WorkerResponse> {
  const keys = await store.getApiKeys();
  if (!keys) {
    return {
      type: "ERROR",
      message: "No API keys set — open the X-Check popup and add your keys.",
    };
  }
  const gemini = new GeminiClient(keys.gemini);

  // 1) Verdict — cached per post text; computed once via the pipeline.
  let verdict = verdictCache.get(req.content);
  if (verdict === undefined) {
    const factCheckClient = new FactCheckDbClient(keys.factCheck);
    const result = await factCheck(gemini, factCheckClient, { content: req.content });
    const postVerdict = result.verdicts[0] ?? null;
    const primary = postVerdict ? pickPrimaryVerdict(postVerdict) : null;
    verdict = primary && isActionable(primary.label) ? primary : null;
    verdictCache.set(req.content, verdict);
  }

  // 2) Tier — DERIVED FROM THE LIVE RISK SCORE on every check.
  const storedProfile = await store.getProfile();
  const riskState = await getOrInitRiskState(storedProfile);
  const score = riskState.score;
  const band = bandFor(score);
  const tier = verdict ? tierForScore(score) : null;

  if (!verdict || tier === null) {
    console.info(
      `[X-Check][risk] post ${req.postId}: score ${score} -> ` +
        (verdict ? "below floor, no intervention" : "verdict none"),
    );
    return {
      type: "DECISION",
      decision: buildDecision({
        postId: req.postId,
        verdict: null,
        tier: "T1",
        band,
        headline: "",
        body: "",
      }),
    };
  }

  // 3) Wording — cached per (post, tier); Gemini only when the tier actually changes.
  const profile = storedProfile ?? NEUTRAL_PROFILE;
  const political = await store.getPolitical();
  const wkey = `${req.content}|${tier}`;
  let text = wordingCache.get(wkey);
  if (!text) {
    text = await generateWording(gemini, tier, verdict, profile, political); // FR6
    wordingCache.set(wkey, text);
  }

  console.info(
    `[X-Check][risk] post ${req.postId}: score ${score} band ${band} -> ${tier} (${verdict.label})`,
  );
  return {
    type: "DECISION",
    decision: buildDecision({
      postId: req.postId,
      verdict,
      tier,
      band,
      headline: text.headline,
      body: text.body,
    }),
  };
}

async function handleRequest(req: WorkerRequest): Promise<WorkerResponse> {
  switch (req.type) {
    case "CHECK_POST":
      return handleCheckPost(req);
    case "BEHAVIOUR_EVENT": {
      const profile = await store.getProfile();
      const state = await getOrInitRiskState(profile);
      const updated = applyEvent(state, req.event);
      const delta = updated.score - state.score;
      const sign = delta >= 0 ? `+${delta}` : `${delta}`;
      console.info(
        `[X-Check][risk] ${req.event.type} ${sign} -> ${updated.score} ` +
          `(band: ${bandFor(updated.score)})`,
      );
      await store.setRiskState(updated);
      return { type: "ACK", tierZone: tierForScore(updated.score) ?? "none" };
    }
  }
}

onWorkerRequest(handleRequest);
