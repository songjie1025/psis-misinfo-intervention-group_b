// Scans the page for posts and maintains a ROLLING WINDOW of interventions (FR5).
// Instead of fact-checking every post on load, we keep only the next N *interventions* live below
// the user's reading position. N scales with the current risk band (low 3, medium 4, high 5), so a
// more vulnerable user gets a slightly wider safety net. As the user scrolls, the window advances:
// posts scrolled past have their boxes removed and posts coming into range get checked/rendered.
// N counts VISIBLE interventions (flagged posts), not posts examined — we keep scanning downward
// until N flagged posts are covered. A dismissed post still counts toward N but shows no box.
// Owns the decision cache, the dismissed set, the MutationObserver and the scroll listener.
import { InterventionDecision } from "../../interventions/types";
import { WorkerRequest, WorkerResponse } from "../../messaging/messages";
import { RiskBand } from "../../scoring/types";
import { POST_SELECTOR, postIdOf } from "./constants";

export interface PostScannerDeps {
  send(msg: WorkerRequest): Promise<WorkerResponse | undefined>;
  render(el: HTMLElement, decision: InterventionDecision, onDismiss: () => void): void;
}

export interface PostScanner {
  start(): void;
  stop(): void;
  reevaluateVisible(): Promise<void>;
}

// How many interventions to keep live below the reading position, by current risk band.
const WINDOW_BY_BAND: Record<RiskBand, number> = { low: 3, medium: 4, high: 5 };
const SCROLL_THROTTLE_MS = 150;

export function createPostScanner({ send, render }: PostScannerDeps): PostScanner {
  // Cache decisions by postId. null = checked, not flagged (no verdict / not actionable).
  const decisions = new Map<string, InterventionDecision | null>();
  // Ephemeral: posts the user dismissed this page load. They still consume a window slot but show
  // no box. Not persisted, so a refresh (fresh content script) brings the intervention back.
  const dismissed = new Set<string>();
  // The postIds that currently SHOULD carry a box — lets reattachBoxes restore them instantly
  // after React wipes them on re-render, without waiting for the async window recompute.
  let windowKeep = new Set<string>();
  // Latest risk band seen from the worker; sizes the window. Defaults to medium (baseline 50).
  let currentBand: RiskBand = "medium";
  let scanning = false;
  let scrollTimer: number | null = null;

  const observer = new MutationObserver(() => {
    reattachBoxes();
    void updateWindow();
  });

  function observe(): void {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // Re-attach cached boxes that React wiped on re-render. Cheap (no worker call), runs on every
  // mutation regardless of the scan lock, so a box never stays gone after a re-render.
  function reattachBoxes(): void {
    document.querySelectorAll<HTMLElement>(POST_SELECTOR).forEach((el) => {
      const postId = postIdOf(el);
      if (!windowKeep.has(postId)) return;
      const cached = decisions.get(postId);
      if (cached && !el.querySelector(".xcheck-intervention")) {
        render(el, cached, () => dismiss(postId));
      }
    });
  }

  function dismiss(postId: string): void {
    dismissed.add(postId);
    windowKeep.delete(postId);
    // Remove this box now; a flagged-but-dismissed post still counts toward N, so recompute the
    // window to pull the next flagged post into range.
    document.querySelectorAll<HTMLElement>(POST_SELECTOR).forEach((el) => {
      if (postIdOf(el) === postId) el.querySelector(".xcheck-intervention")?.remove();
    });
    void updateWindow();
  }

  /** Ask the worker to check one post; cache + return its decision (null = not flagged). */
  async function checkPost(el: HTMLElement, postId: string): Promise<InterventionDecision | null> {
    const content = (el.innerText || "").trim();
    if (!content) return null; // not loaded yet — don't cache, let it be rechecked

    const res = await send({ type: "CHECK_POST", postId, content });
    if (!res || res.type !== "DECISION") {
      if (res && res.type === "ERROR") console.warn("[X-Check] check failed:", res.message);
      return null;
    }
    // The band is score-derived and present on every decision, even non-intervening ones.
    currentBand = res.decision.riskBand;
    const decision = res.decision.shouldIntervene ? res.decision : null;
    decisions.set(postId, decision);
    return decision;
  }

  /**
   * Recompute the rolling window: starting at the first post at/below the top of the viewport,
   * walk downward and keep the next N flagged posts covered (rendering a box unless dismissed).
   * Everything outside that set has its box removed.
   */
  async function updateWindow(): Promise<void> {
    if (scanning) return;
    scanning = true;
    observer.disconnect();
    try {
      const posts = Array.from(document.querySelectorAll<HTMLElement>(POST_SELECTOR));
      const keep = new Set<string>();
      let placed = 0;
      let started = false;

      for (const el of posts) {
        if (placed >= WINDOW_BY_BAND[currentBand]) break; // window is full
        // Skip posts scrolled entirely above the reading position.
        if (!started) {
          if (el.getBoundingClientRect().bottom < 0) continue;
          started = true;
        }
        const postId = postIdOf(el);
        let decision = decisions.get(postId);
        if (decision === undefined) decision = await checkPost(el, postId);
        if (!decision) continue; // not flagged -> doesn't consume a window slot

        placed++; // flagged posts count toward N whether or not they're dismissed
        if (dismissed.has(postId)) continue; // counts, but no box
        keep.add(postId);
        if (!el.querySelector(".xcheck-intervention")) {
          render(el, decision, () => dismiss(postId));
        }
      }

      windowKeep = keep;
      // Remove boxes on any post no longer in the window (scrolled past, beyond it, or dismissed).
      document.querySelectorAll<HTMLElement>(POST_SELECTOR).forEach((el) => {
        if (!keep.has(postIdOf(el))) el.querySelector(".xcheck-intervention")?.remove();
      });
    } finally {
      scanning = false;
      observe();
      reattachBoxes();
    }
  }

  /** Re-evaluate when the Risk Score crosses a tier/band boundary: verdicts are unchanged but the
   *  tier wording and window SIZE may differ, so drop the cache and rebuild the window. */
  async function reevaluateVisible(): Promise<void> {
    decisions.clear();
    await updateWindow();
  }

  function onScroll(): void {
    if (scrollTimer !== null) return;
    scrollTimer = window.setTimeout(() => {
      scrollTimer = null;
      void updateWindow();
    }, SCROLL_THROTTLE_MS);
  }

  function start(): void {
    void updateWindow();
    observe();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function stop(): void {
    observer.disconnect();
    window.removeEventListener("scroll", onScroll);
    if (scrollTimer !== null) {
      clearTimeout(scrollTimer);
      scrollTimer = null;
    }
  }

  return { start, stop, reevaluateVisible };
}
