// The wire contract between content-script and the service worker (§4).
import { BehaviourEvent } from "../scoring/types";
import { InterventionDecision } from "../interventions/types";

// ---- content-script → service worker ----

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

// ---- service worker → content-script ----

export interface DecisionResponse {
  type: "DECISION";
  decision: InterventionDecision;
}

export interface AckResponse {
  type: "ACK";
}

export interface ErrorResponse {
  type: "ERROR";
  message: string;
}

export type WorkerResponse = DecisionResponse | AckResponse | ErrorResponse;
