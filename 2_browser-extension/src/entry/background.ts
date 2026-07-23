// X-Check service worker — the orchestrator.
// Verdicts are PRE-BAKED: looked up per post id from posts.json (see ../pipeline/mockFactCheck),
// so no Gemini / Fact Check API call is needed for a verdict. Gemini is optional and affects only
// the wording. The intervention TIER is still derived from the LIVE Risk Score on every check.
import { onWorkerRequest } from "../messaging/bridge";
import { deliverWordingToContentTab } from "../messaging/wordingDelivery";
import {
  CheckPostRequest,
  WorkerRequest,
  WorkerResponse,
  WordingReadyNotification,
} from "../messaging/messages";
import { factCheck, FactCheckResult } from "../pipeline/mockFactCheck";
import { GeminiClient, GeminiRequestError } from "../pipeline/geminiClient";
import { Verdict } from "../pipeline/types";
import { getRandomQuiz } from "../quiz/quizBank";
import { store } from "../storage/store";
import { bandFor, baselineFromProfile, NEUTRAL_BASELINE } from "../scoring/riskScore";
import {
  applyEvent,
  hasRecordedReflectivePost,
  initialState,
  isPerPostReflectiveEvent,
  recordReflectivePost,
} from "../scoring/learning";
import { RiskState } from "../scoring/types";
import { PersonalityProfile } from "../profile/types";
import { tierForScore } from "../interventions/selector";
import { buildDecision, isActionable } from "../interventions/decision";
import { Tier } from "../interventions/types";
import { generateWording, InterventionText, isFallbackWording } from "../interventions/wording";
import { prewrittenWordingFor } from "../interventions/mockWording";
import {
  createWordingRequestCoordinator,
  shouldGenerateWording,
  wordingCacheKey,
} from "../interventions/wordingCache";
import { dlog } from "../debug";

const RATE_LIMIT_COOLDOWN_MS = 60_000;
const MIN_GEMINI_REQUEST_INTERVAL_MS = 4_000;
// A post check must never make feed rendering wait on a network request. If Gemini has not
// returned inside this small UI budget, the pre-written T2/T3 copy is rendered immediately and
// the validated model result is pushed later, if it arrives.
const LIVE_WORDING_BUDGET_MS = 350;
const GENERIC_FAILURE_COOLDOWN_MS = 60_000;

const NEUTRAL_PROFILE: PersonalityProfile = {
  openness: "neutral",
  conscientiousness: "neutral",
  extraversion: "neutral",
  agreeableness: "neutral",
  neuroticism: "neutral",
};
const wordingCoordinator = createWordingRequestCoordinator();
// chrome.runtime delivers requests independently. Serialize stateful behaviour writes so two
// very fast clicks cannot both read the same old RiskState and overwrite one another.
let behaviourUpdateQueue: Promise<void> = Promise.resolve();

// Cache the pre-baked fact-check per post id (null = looked up, no verdict). Cheap, but avoids
// re-reading posts.json for every re-check.
const factCheckCache = new Map<string, FactCheckResult | null>();

console.info("[X-Check] service worker loaded");

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function serializeBehaviourUpdate<T>(operation: () => Promise<T>): Promise<T> {
  const result = behaviourUpdateQueue.then(operation, operation);
  behaviourUpdateQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function sameWording(left: InterventionText, right: InterventionText): boolean {
  return left.headline === right.headline && left.body === right.body;
}

/** Resolve a wording request only while it can still keep up with an on-screen intervention. */
function withinLiveWordingBudget(
  pending: Promise<InterventionText>,
): Promise<InterventionText | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timeout = setTimeout(() => {
      settled = true;
      resolve(null);
    }, LIVE_WORDING_BUDGET_MS);
    void pending.then(
      (text) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(text);
      },
      () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(null);
      },
    );
  });
}

/** Upgrade the exact tab that originally rendered the deterministic fallback. */
function notifyWordingReady(
  tabId: number | undefined,
  notification: WordingReadyNotification,
): void {
  void deliverWordingToContentTab(tabId, notification, (targetTabId, message) =>
    chrome.tabs.sendMessage(targetTabId, message),
  ).then((delivered) => {
    if (delivered) {
      // Deliberately omit prompt, generated content and credentials from diagnostic logs.
      console.info(`[X-Check][wording] Gemini wording delivered to tab for post ${notification.postId}.`);
    }
  });
}

/**
 * The worker-wide coordinator makes this safe inside a service worker; session storage preserves
 * the interval across worker suspension. At most one new wording request starts every 4 seconds.
 */
async function waitForGeminiRateSlot(): Promise<void> {
  const nextAllowedAt = await store.getWordingNextAllowedAt();
  const delay = Math.max(0, nextAllowedAt - Date.now());
  if (delay > 0) await wait(delay);
  await store.setWordingNextAllowedAt(Date.now() + MIN_GEMINI_REQUEST_INTERVAL_MS);
}

async function getGeneratedWording(args: {
  postId: string;
  tier: Tier;
  verdict: Verdict;
  profile: PersonalityProfile | null;
  tabId: number | undefined;
}): Promise<InterventionText> {
  const profile = args.profile ?? NEUTRAL_PROFILE;
  const political = await store.getPolitical();
  const fallback = prewrittenWordingFor(
    args.postId,
    args.tier,
    args.verdict,
    profile,
    political,
  );
  const apiKeys = await store.getApiKeys();
  const geminiKey = apiKeys?.gemini;
  // T1 stays static by design: the compact T1 UI deliberately has no generated copy.
  if (!shouldGenerateWording(args.tier, geminiKey)) return fallback;

  const cacheKey = wordingCacheKey({
    postId: args.postId,
    tier: args.tier,
    profile,
    political,
  });
  const cacheEpoch = await store.getWordingCacheEpoch();
  const cached = await store.getCachedWording(cacheKey);
  if (cached) return { headline: cached.headline, body: cached.body };
  if (Date.now() < (await store.getWordingCooldownUntil())) return fallback;

  const pending = wordingCoordinator.resolve(cacheKey, fallback, async () => {
    // A second event may arrive while this request waits in the worker queue.
    // Re-check session storage so it cannot cause a duplicate Gemini call.
    const cachedAfterQueue = await store.getCachedWording(cacheKey);
    if (cachedAfterQueue) {
      return { headline: cachedAfterQueue.headline, body: cachedAfterQueue.body };
    }
    if (Date.now() < (await store.getWordingCooldownUntil())) return null;

    // This is after cache/cooldown checks, so cached and unavailable cases remain instant.
    await waitForGeminiRateSlot();
    if (Date.now() < (await store.getWordingCooldownUntil())) return null;

    // The user could have cleared data or changed their profile/key while this item was queued.
    // Re-read all mutable inputs before creating a client so an old credential is never used.
    if (cacheEpoch !== (await store.getWordingCacheEpoch())) return null;
    const currentGeminiKey = (await store.getApiKeys())?.gemini;
    if (!shouldGenerateWording(args.tier, currentGeminiKey)) return null;
    const currentProfile = (await store.getProfile()) ?? NEUTRAL_PROFILE;
    const currentPolitical = await store.getPolitical();
    if (
      cacheKey !==
      wordingCacheKey({
        postId: args.postId,
        tier: args.tier,
        profile: currentProfile,
        political: currentPolitical,
      })
    ) {
      return null;
    }

    try {
      const text = await generateWording(
        new GeminiClient(currentGeminiKey),
        args.tier,
        args.verdict,
        currentProfile,
        currentPolitical,
      );
      // Invalid/blocked model output must retain the deterministic mock fallback.
      if (isFallbackWording(text)) {
        await store.setWordingCooldownUntil(Date.now() + GENERIC_FAILURE_COOLDOWN_MS);
        return null;
      }
      // A privacy reset while the request was in flight makes the response stale.
      if (cacheEpoch !== (await store.getWordingCacheEpoch())) return null;
      await store.setCachedWording(cacheKey, text, cacheEpoch);
      if (cacheEpoch !== (await store.getWordingCacheEpoch())) return null;
      return text;
    } catch (error) {
      const cooldown =
        error instanceof GeminiRequestError && error.status === 429
          ? Math.max(RATE_LIMIT_COOLDOWN_MS, error.retryAfterMs ?? 0)
          : GENERIC_FAILURE_COOLDOWN_MS;
      // This includes timeout, invalid key and final HTTP failures. A cooldown prevents a fast
      // scroll through 50 posts from turning one outage/quota rejection into 50 extra requests.
      await store.setWordingCooldownUntil(Date.now() + cooldown);
      // Never log prompts, generated text, or credentials.
      console.warn("[X-Check][wording] Gemini unavailable; using mock wording.");
      return null;
    }
  });

  const liveText = await withinLiveWordingBudget(pending);
  if (liveText && !sameWording(liveText, fallback)) return liveText;

  // The original CHECK_POST response must return now. Keep the one existing queued request
  // running: when it succeeds, the content script upgrades its visible fallback in place.
  void pending.then((text) => {
    if (sameWording(text, fallback)) return;
    notifyWordingReady(args.tabId, {
      type: "WORDING_READY",
      postId: args.postId,
      tier: args.tier,
      headline: text.headline,
      body: text.body,
    });
  });
  return fallback;
}

async function getOrInitRiskState(
  profile: PersonalityProfile | null,
): Promise<RiskState> {
  const existing = await store.getRiskState();
  if (existing) return existing;
  // Use the questionnaire-derived baseline whenever a saved profile is available. A brand-new
  // user may reach the worker before onboarding finishes, so only that case stays neutral.
  const baseline = profile ? baselineFromProfile(profile) : NEUTRAL_BASELINE;
  const state = initialState(baseline);
  await store.setRiskState(state);
  return state;
}

async function handleCheckPost(
  req: CheckPostRequest,
  tabId: number | undefined,
): Promise<WorkerResponse> {
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

  // No verdict, or score below the intervention floor -> no intervention. Keep an actionable
  // verdict in the decision when it is merely hidden by the score floor: the content script
  // records `isFlagged` separately, so liking/sharing this post can still raise a low score.
  if (!verdict || !isActionable(verdict.label) || tier === null) {
    dlog(
      `[risk] post ${req.postId}: score ${score} -> ` +
        (verdict ? "below floor, no intervention" : "no verdict"),
    );
    return {
      type: "DECISION",
      decision: buildDecision({
        postId: req.postId,
        verdict,
        tier: "T1",
        band,
        headline: "",
        body: "",
        shouldIntervene: false,
      }),
    };
  }

  // 3) Wording only: verdict, sources, tier and score remain entirely local/mock-driven.
  const wording = await getGeneratedWording({
    postId: req.postId,
    tier,
    verdict,
    profile: storedProfile,
    tabId,
  });

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
      headline: wording.headline,
      body: wording.body,
    }),
  };
}

async function handleGetQuiz(): Promise<WorkerResponse> {
  const quiz = await getRandomQuiz();
  return { type: "QUIZ", quiz };
}

async function handleRequest(
  req: WorkerRequest,
  sender: chrome.runtime.MessageSender,
): Promise<WorkerResponse> {
  switch (req.type) {
    case "CHECK_POST":
      return handleCheckPost(req, sender.tab?.id);
    case "GET_QUIZ":
      return handleGetQuiz();
    case "BEHAVIOUR_EVENT":
      return serializeBehaviourUpdate(async () => {
        const profile = await store.getProfile();
        const state = await getOrInitRiskState(profile);

        // A warning-body click and a source click are two forms of the same reflective action.
        // The first one per post earns the reduction; all later attempts are true no-ops, even
        // after a page refresh, because the post ID lives inside the persisted RiskState.
        if (
          isPerPostReflectiveEvent(req.event) &&
          hasRecordedReflectivePost(state, req.event.postId)
        ) {
          console.info(
            `[X-Check][risk] ${req.event.type} post ${req.event.postId}: already rewarded`,
          );
          return { type: "ACK", tierZone: tierForScore(state.score) ?? "none" };
        }

        let updated = applyEvent(state, req.event);
        if (isPerPostReflectiveEvent(req.event)) {
          updated = recordReflectivePost(updated, req.event.postId);
        }
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
      });
  }
}

onWorkerRequest(handleRequest);
