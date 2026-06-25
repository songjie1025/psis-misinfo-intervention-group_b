// X-Check service worker — the orchestrator.
// Receives a post from the content-script, runs the full pipeline + scoring + intervention
// decision, and returns ONE InterventionDecision. Also folds behaviour events into the
// Risk Score (learning loop, FR4).
import { onWorkerRequest } from "../messaging/bridge";
import {
  CheckPostRequest,
  WorkerRequest,
  WorkerResponse,
} from "../messaging/messages";
import { factCheck } from "../pipeline/pipeline";
import { GeminiClient } from "../pipeline/geminiClient";
import { FactCheckDbClient } from "../pipeline/googleClient";
import { store } from "../storage/store";
import { bandFor, baselineFromProfile } from "../scoring/riskScore";
import { applyEvent, initialState } from "../scoring/learning";
import { RiskState } from "../scoring/types";
import { PersonalityProfile } from "../profile/types";
import { selectTier } from "../interventions/selector";
import {
  buildDecision,
  isActionable,
  pickPrimaryVerdict,
} from "../interventions/decision";
import { generateWording } from "../interventions/wording";

const DEFAULT_BASELINE = 50;

// Used for wording before the user has completed the questionnaire, so the personalization
// path still runs (neutral tone) instead of silently doing nothing.
const NEUTRAL_PROFILE: PersonalityProfile = {
  openness: "neutral",
  conscientiousness: "neutral",
  extraversion: "neutral",
  agreeableness: "neutral",
  neuroticism: "neutral",
};

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

  const storedProfile = await store.getProfile();
  const profile = storedProfile ?? NEUTRAL_PROFILE;
  const political = await store.getPolitical(); // optional; null = not answered
  const riskState = await getOrInitRiskState(storedProfile);
  const band = bandFor(riskState.score);
  const tier = selectTier(band); // FR5: tier from Risk Score band alone

  const gemini = new GeminiClient(keys.gemini);
  const factCheckClient = new FactCheckDbClient(keys.factCheck);

  const result = await factCheck(gemini, factCheckClient, {
    content: req.content,
  });
  const postVerdict = result.verdicts[0] ?? null;
  const verdict = postVerdict ? pickPrimaryVerdict(postVerdict) : null;

  let headline = "";
  let body = "";
  if (verdict && isActionable(verdict.label)) {
    // FR6: personality (+ optional political) adapt the wording.
    const text = await generateWording(gemini, tier, verdict, profile, political);
    headline = text.headline;
    body = text.body;
  }

  // Flat debug log: which post mapped to which tier at the current Risk Score.
  console.info(
    `[X-Check][risk] check post ${req.postId}: score ${riskState.score} ` +
      `band ${band} -> ${tier} (verdict ${verdict ? verdict.label : "none"})`,
  );

  return {
    type: "DECISION",
    decision: buildDecision({ postId: req.postId, verdict, tier, band, headline, body }),
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
      // Flat debug log: which event moved the Risk Score and where it landed.
      console.info(
        `[X-Check][risk] ${req.event.type} ${sign} -> ${updated.score} ` +
          `(band: ${bandFor(updated.score)})`,
      );
      await store.setRiskState(updated);
      return { type: "ACK" };
    }
  }
}

onWorkerRequest(handleRequest);
