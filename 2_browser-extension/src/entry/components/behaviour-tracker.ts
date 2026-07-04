// FR4 real-time behaviour signals: dwell, scroll velocity, and like/share of flagged posts.
// Emits BEHAVIOUR_EVENTs to the worker; when an ACK reports a new tier zone it calls onZoneChange
// so the scanner can re-evaluate visible posts.
import { makeEvent } from "../../scoring/behaviour";
import { BehaviourEvent } from "../../scoring/types";
import { WorkerRequest, WorkerResponse } from "../../messaging/messages";
import { BehaviourHud } from "./behaviour-hud";
import {
  POST_SELECTOR,
  SHORT_DWELL_MS,
  LONG_DWELL_MS,
  FAST_SCROLL_PX_PER_S,
  postIdOf,
} from "./constants";

export interface BehaviourTrackerDeps {
  send(msg: WorkerRequest): Promise<WorkerResponse | undefined>;
  onZoneChange(): void;
  /** Optional debug HUD: fed each event's live score and continuous dwell/scroll metrics. */
  hud?: BehaviourHud;
}

export interface BehaviourTracker {
  start(): void;
  emit(event: BehaviourEvent): void;
}

export function createBehaviourTracker({
  send,
  onZoneChange,
  hud,
}: BehaviourTrackerDeps): BehaviourTracker {
  let lastZone: string | undefined;

  // Live metrics for the debug HUD: the enter-time of the post currently in view, and the
  // most recent scroll velocity (decays to 0 when the user stops).
  let currentEnter: number | undefined;
  let lastVelocity = 0;
  let lastScrollAt = 0;

  /** Send a behaviour event and, if it moved the Risk Score across a tier boundary, notify. */
  function emit(event: BehaviourEvent): void {
    void send({ type: "BEHAVIOUR_EVENT", event }).then((res) => {
      if (!res || res.type !== "ACK") return;
      if (hud && typeof res.score === "number") hud.logEvent(event, res.score);
      if (res.tierZone && res.tierZone !== lastZone) {
        lastZone = res.tierZone;
        onZoneChange();
      }
    });
  }

  function trackDwellAndScroll(): void {
    const enterTimes = new WeakMap<Element, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const el = entry.target as HTMLElement;
          if (entry.isIntersecting) {
            const now = Date.now();
            enterTimes.set(el, now);
            currentEnter = now; // HUD: newest post in view
          } else {
            const enteredAt = enterTimes.get(el);
            if (enteredAt === undefined) continue;
            enterTimes.delete(el);
            currentEnter = undefined; // HUD: no post in view

            if (el.dataset.xcheckDwellCounted) continue; // count each post once
            const dwell = Date.now() - enteredAt;
            const postId = postIdOf(el);
            if (dwell < SHORT_DWELL_MS) {
              el.dataset.xcheckDwellCounted = "true";
              emit(makeEvent("SHORT_DWELL_POST", postId, dwell));
            } else if (dwell >= LONG_DWELL_MS) {
              el.dataset.xcheckDwellCounted = "true";
              emit(makeEvent("LONG_DWELL_POST", postId, dwell));
            }
          }
        }
      },
      { threshold: 0.5 },
    );

    const observePosts = (): void =>
      document.querySelectorAll<HTMLElement>(POST_SELECTOR).forEach((el) => io.observe(el));
    observePosts();
    new MutationObserver(observePosts).observe(document.body, {
      childList: true,
      subtree: true,
    });

    let lastY = window.scrollY;
    let lastT = Date.now();
    let throttled: number | undefined;
    // Cheap per-event velocity for the HUD meter (separate from the throttled emit below).
    let hudY = window.scrollY;
    let hudT = Date.now();
    window.addEventListener(
      "scroll",
      () => {
        // HUD velocity: measured on every scroll event so the meter is responsive.
        const nowH = Date.now();
        const dtH = (nowH - hudT) / 1000;
        if (dtH > 0) lastVelocity = Math.abs(window.scrollY - hudY) / dtH;
        hudY = window.scrollY;
        hudT = nowH;
        lastScrollAt = nowH;

        if (throttled !== undefined) return;
        throttled = window.setTimeout(() => {
          const now = Date.now();
          const y = window.scrollY;
          const dt = (now - lastT) / 1000;
          const velocity = dt > 0 ? Math.abs(y - lastY) / dt : 0;
          lastY = y;
          lastT = now;
          throttled = undefined;
          if (velocity > FAST_SCROLL_PX_PER_S) {
            emit(makeEvent("FAST_SCROLL", undefined, Math.round(velocity)));
          }
        }, 1500);
      },
      { passive: true },
    );

    // Feed the HUD live dwell/scroll meters. Velocity decays to 0 shortly after scrolling stops.
    if (hud) {
      window.setInterval(() => {
        const now = Date.now();
        const dwellMs = currentEnter !== undefined ? now - currentEnter : 0;
        const velocity = now - lastScrollAt > 400 ? 0 : lastVelocity;
        hud.setMetrics({ dwellMs, velocity });
      }, 150);
    }
  }

  // Like / share of a FLAGGED post raises the Risk Score (FR4). One delegated capture-phase
  // listener so it fires even though the page calls stopPropagation on the button.
  function trackLikesAndShares(): void {
    document.addEventListener(
      "click",
      (e) => {
        const target = e.target as HTMLElement;
        const likeBtn = target.closest("[data-xcheck-like]");
        const shareBtn = target.closest("[data-xcheck-share]");
        if (!likeBtn && !shareBtn) return;
        const post = (likeBtn ?? shareBtn)?.closest<HTMLElement>(POST_SELECTOR);
        if (!post || post.dataset.xcheckFlagged !== "true") return;
        emit(makeEvent(likeBtn ? "LIKE_FLAGGED" : "SHARE_FLAGGED", post.dataset.xcheckPostId));
      },
      true,
    );
  }

  function start(): void {
    trackDwellAndScroll();
    trackLikesAndShares();
  }

  return { start, emit };
}
