// The wire contract between content-script and the service worker (§4).
import { BehaviourEvent } from "../scoring/types";
import { InterventionDecision } from "../interventions/types";

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

export type WorkerRequest = CheckPostRequest | BehaviourEventMessage;

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
  // Live Risk Score after the event (0–100). Used by the on-page debug HUD; band/tier are
  // derived from it on the content-script side (single source of truth).
  score?: number;
}

export interface ErrorResponse {
  type: "ERROR";
  message: string;
}

export type WorkerResponse = DecisionResponse | AckResponse | ErrorResponse;
