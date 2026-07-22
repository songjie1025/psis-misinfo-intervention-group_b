// The wire contract between content-script and the service worker (§4).
import { BehaviourEvent } from "../scoring/types";
import { InterventionDecision } from "../interventions/types";
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

/** Ask for a random quiz question (feed intervention, unrelated to the Risk Score). */
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
