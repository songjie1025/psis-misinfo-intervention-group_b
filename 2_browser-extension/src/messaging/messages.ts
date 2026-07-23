// The wire contract between content-script and the service worker (§4).
import { BehaviourEvent } from "../scoring/types";
import { InterventionDecision, Tier } from "../interventions/types";
import { QuizPayload } from "../quiz/types";

// ---- content-script -> service worker ----

export interface CheckPostRequest {
  type: "CHECK_POST";
  postId: string;
  content: string;
}

export interface BehaviourEventMessage {
  type: "BEHAVIOUR_EVENT";
  event: BehaviourEvent;
}

/** Ask for a random quiz question. Only a later correct answer changes Risk Score (-10). */
export interface GetQuizRequest {
  type: "GET_QUIZ";
}

export type WorkerRequest = CheckPostRequest | BehaviourEventMessage | GetQuizRequest;

// ---- service worker -> content-script ----

export interface DecisionResponse {
  type: "DECISION";
  decision: InterventionDecision;
}

export interface AckResponse {
  type: "ACK";
  // Current tier zone after the event ("none" | "T1" | "T2" | "T3"). When this changes, the
  // content-script re-evaluates visible posts so interventions follow the live Risk Score.
  tierZone?: string;
}

export interface ErrorResponse {
  type: "ERROR";
  message: string;
}

export interface QuizResponse {
  type: "QUIZ";
  // null when quiz_questions.json has no usable entries.
  quiz: QuizPayload | null;
}

export type WorkerResponse = DecisionResponse | AckResponse | ErrorResponse | QuizResponse;

// ---- service worker -> content-script notification ----

/**
 * Sent only after an asynchronous Gemini request has produced validated wording. The original
 * CHECK_POST request has already received deterministic mock wording, so this never holds up
 * scrolling or intervention rendering.
 */
export interface WordingReadyNotification {
  type: "WORDING_READY";
  postId: string;
  tier: Tier;
  headline: string;
  body: string;
}

export function isWorkerRequest(message: unknown): message is WorkerRequest {
  if (typeof message !== "object" || message === null) return false;
  const type = (message as { type?: unknown }).type;
  return type === "CHECK_POST" || type === "BEHAVIOUR_EVENT" || type === "GET_QUIZ";
}

export function isWordingReadyNotification(
  message: unknown,
): message is WordingReadyNotification {
  if (typeof message !== "object" || message === null) return false;
  const candidate = message as Partial<WordingReadyNotification>;
  return (
    candidate.type === "WORDING_READY" &&
    typeof candidate.postId === "string" &&
    (candidate.tier === "T1" || candidate.tier === "T2" || candidate.tier === "T3") &&
    typeof candidate.headline === "string" &&
    typeof candidate.body === "string"
  );
}
