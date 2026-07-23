// Behaviour signal definitions (FR4).
import { BehaviourEvent, BehaviourEventType } from "./types";

/**
 * How much each behaviour shifts the Risk Score.
 * Positive = more vulnerable, negative = more reflective. All values are tunable (§9).
 */
export const EVENT_WEIGHTS: Record<BehaviourEventType, number> = {
  SHARE_FLAGGED: 20,
  LIKE_FLAGGED: 10,
  DISMISS_INTERVENTION: 5,
  SHORT_DWELL_POST: 1,
  FAST_SCROLL: 1,
  LONG_DWELL_POST: -3,
  READ_EXPANDED_WARNING: -8,
  CLICK_TRUSTED_SOURCE: -12,
  QUIZ_CORRECT: -10,
  // Exact inverses of LIKE_FLAGGED / SHARE_FLAGGED so toggling the action off cancels the raise.
  UNLIKE_FLAGGED: -10,
  UNSHARE_FLAGGED: -20,
  // Dashboard impression signal — deliberately weightless (never affects the Risk Score).
  FAKE_POST_SEEN: 0,
};

export function makeEvent(
  type: BehaviourEventType,
  postId?: string,
  value?: number,
): BehaviourEvent {
  return { type, postId, value, timestamp: Date.now() };
}
