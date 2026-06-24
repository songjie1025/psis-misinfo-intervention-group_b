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
  openness: "medium",
  conscientiousness: "medium",
  extraversion: "medium",
  agreeableness: "medium",
  neuroticism: "medium",
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
    const text = await generateWording(gemini, tier, verdict, profile); // FR6
    headline = text.headline;
    body = text.body;
  }

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
      await store.setRiskState(applyEvent(state, req.event));
      return { type: "ACK" };
    }
  }
}

onWorkerRequest(handleRequest);
