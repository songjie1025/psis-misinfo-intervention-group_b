// X-Check service worker — the orchestrator.
// Verdicts are PRE-BAKED: looked up per post id from posts.json (see ../pipeline/mockFactCheck),
// so no Gemini / Fact Check API calls (or keys) are needed. The intervention TIER and wording are
// still derived from the LIVE Risk Score on every check, so interventions follow the score.
import { onWorkerRequest } from "../messaging/bridge";
import {
  CheckPostRequest,
  WorkerRequest,
  WorkerResponse,
} from "../messaging/messages";
import { factCheck, FactCheckResult } from "../pipeline/mockFactCheck";
import { store } from "../storage/store";
import { bandFor } from "../scoring/riskScore";
import { applyEvent, initialState } from "../scoring/learning";
import { RiskState } from "../scoring/types";
import { PersonalityProfile } from "../profile/types";
import { tierForScore } from "../interventions/selector";
import { buildDecision } from "../interventions/decision";
import { dlog } from "../debug";

const DEFAULT_BASELINE = 50;

// Cache the pre-baked fact-check per post id (null = looked up, no verdict). Cheap, but avoids
// re-reading posts.json for every re-check.
const factCheckCache = new Map<string, FactCheckResult | null>();

console.info("[X-Check] service worker loaded");

async function getOrInitRiskState(
  profile: PersonalityProfile | null,
): Promise<RiskState> {
  const existing = await store.getRiskState();
  if (existing) return existing;
  // The Big5 questionnaire must NOT seed the risk score — always start from the neutral baseline.
  const baseline = DEFAULT_BASELINE;
  void profile; // intentionally unused (kept for signature symmetry)
  const state = initialState(baseline);
  await store.setRiskState(state);
  return state;
}

async function handleCheckPost(req: CheckPostRequest): Promise<WorkerResponse> {
  // 1) Verdict — pre-baked fact-check looked up by POST ID from posts.json (no API / no keys).
  let result = factCheckCache.get(req.postId);
  if (result === undefined) {
    result = await factCheck(req.postId);
    factCheckCache.set(req.postId, result);
    dlog(
      `[fc] post ${req.postId} -> ${result ? result.verdict.label : "no verdict (empty)"}`,
    );
  }
  const verdict = result ? result.verdict : null;

  // 2) Tier — DERIVED FROM THE LIVE RISK SCORE on every check.
  const storedProfile = await store.getProfile();
  const riskState = await getOrInitRiskState(storedProfile);
  const score = riskState.score;
  const band = bandFor(score);
  const tier = verdict ? tierForScore(score) : null;

  // No verdict, or score below the intervention floor -> no intervention.
  if (!verdict || tier === null) {
    dlog(
      `[risk] post ${req.postId}: score ${score} -> ` +
        (verdict ? "below floor, no intervention" : "no verdict"),
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

  // 3) Fact-check response text. Static placeholder for now; an LLM will generate this later.
  const responseText = result ? result.response : "";

  dlog(
    `[risk] post ${req.postId}: score ${score} band ${band} -> ${tier} (${verdict.label})`,
  );
  return {
    type: "DECISION",
    decision: buildDecision({
      postId: req.postId,
      verdict,
      tier,
      band,
      headline: responseText,
      body: "",
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
      // Persist for the interaction dashboard (includes weightless FAKE_POST_SEEN impressions).
      await store.appendInteraction({
        t: req.event.timestamp,
        type: req.event.type,
        postId: req.event.postId,
      });
      return {
        type: "ACK",
        tierZone: tierForScore(updated.score) ?? "none",
      };
    }
  }
}

onWorkerRequest(handleRequest);
