// FR4 real-time behaviour signals: dwell, scroll velocity, and like/share of flagged posts.
// Emits BEHAVIOUR_EVENTs to the worker; when an ACK reports a new tier zone it calls onZoneChange
// so the scanner can re-evaluate visible posts.
import { makeEvent } from "../../scoring/behaviour";
import { BehaviourEvent } from "../../scoring/types";
import { WorkerRequest, WorkerResponse } from "../../messaging/messages";
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
}

export interface BehaviourTracker {
  start(): void;
  emit(event: BehaviourEvent): void;
}

export function createBehaviourTracker({
  send,
  onZoneChange,
}: BehaviourTrackerDeps): BehaviourTracker {
  let lastZone: string | undefined;

  /** Send a behaviour event and, if it moved the Risk Score across a tier boundary, notify. */
  function emit(event: BehaviourEvent): void {
    void send({ type: "BEHAVIOUR_EVENT", event }).then((res) => {
      if (res && res.type === "ACK" && res.tierZone && res.tierZone !== lastZone) {
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
            enterTimes.set(el, Date.now());
          } else {
            const enteredAt = enterTimes.get(el);
            if (enteredAt === undefined) continue;
            enterTimes.delete(el);
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
    window.addEventListener(
      "scroll",
      () => {
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
  }

  // Like / share of a FLAGGED post raises the Risk Score (FR4). One delegated capture-phase
  // listener so it fires even though the page calls stopPropagation on the button.
  //
  // Like/share are TOGGLES: a second click un-likes / un-shares. We run in the capture phase,
  // BEFORE React flips the button's state, so the button's current colour class tells us the
  // pre-click state — liking emits the raise, un-liking emits the exact inverse so repeated
  // toggling nets to zero (the score only stays raised while the post is actually liked/shared).
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
        const postId = post.dataset.xcheckPostId;
        if (likeBtn) {
          const wasLiked = likeBtn.classList.contains("text-red-400"); // liked colour
          emit(makeEvent(wasLiked ? "UNLIKE_FLAGGED" : "LIKE_FLAGGED", postId));
        } else if (shareBtn) {
          const wasShared = shareBtn.classList.contains("text-green-400"); // shared colour
          emit(makeEvent(wasShared ? "UNSHARE_FLAGGED" : "SHARE_FLAGGED", postId));
        }
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
