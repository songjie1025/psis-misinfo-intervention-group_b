// Scans the page for posts, asks the worker to check each, renders the resulting intervention,
// and re-evaluates already-checked posts when the tier zone changes. Owns the decision cache and
// the MutationObserver. Rendering and worker comms are injected.
import { InterventionDecision } from "../../interventions/types";
import { WorkerRequest, WorkerResponse } from "../../messaging/messages";
import { POST_SELECTOR, CHECK_DELAY_MS, postIdOf } from "./constants";

export interface PostScannerDeps {
  send(msg: WorkerRequest): Promise<WorkerResponse | undefined>;
  render(el: HTMLElement, decision: InterventionDecision): void;
}

export interface PostScanner {
  start(): void;
  stop(): void;
  reevaluateVisible(): Promise<void>;
}

export function createPostScanner({ send, render }: PostScannerDeps): PostScanner {
  // Cache decisions by postId. The mockup is React: when it re-renders a post it wipes our
  // injected banner. The cache lets us re-attach it WITHOUT re-calling the pipeline.
  // null = checked, no box.
  const decisions = new Map<string, InterventionDecision | null>();
  let scanning = false;

  const observer = new MutationObserver(() => {
    reattachBoxes();
    void safeScan();
  });

  // Re-attach cached intervention boxes that React wiped on re-render. Cheap (no API), runs on
  // EVERY DOM mutation regardless of the scan lock, so a box never stays gone after a re-render.
  function reattachBoxes(): void {
    document.querySelectorAll<HTMLElement>(POST_SELECTOR).forEach((el) => {
      const cached = decisions.get(postIdOf(el));
      if (cached && !el.querySelector(".xcheck-intervention")) render(el, cached);
    });
  }

  function observe(): void {
    observer.observe(document.body, { childList: true, subtree: true });
  }

  async function safeScan(): Promise<void> {
    observer.disconnect();
    try {
      await scanPosts();
    } finally {
      observe();
      // Restore any cached boxes wiped while the observer was off — e.g. the user navigated into
      // a post detail and back during a slow (429-throttled) scan.
      reattachBoxes();
    }
  }

  async function scanPosts(): Promise<void> {
    if (scanning) return;
    scanning = true;
    try {
      const posts = Array.from(
        document.querySelectorAll<HTMLElement>(POST_SELECTOR),
      ).filter((el) => !decisions.has(postIdOf(el))); // only NEW; reattachBoxes restores the rest
      for (const el of posts) {
        await checkPost(el, postIdOf(el));
        await new Promise((resolve) => setTimeout(resolve, CHECK_DELAY_MS));
      }
    } finally {
      scanning = false;
    }
  }

  async function checkPost(el: HTMLElement, postId: string): Promise<void> {
    const content = (el.innerText || "").trim();
    if (!content) return;

    const res = await send({ type: "CHECK_POST", postId, content });
    if (!res) return;
    if (res.type === "ERROR") {
      console.warn("[X-Check] check failed:", res.message);
      return;
    }
    if (res.type !== "DECISION") return;

    const decision = res.decision.shouldIntervene ? res.decision : null;
    decisions.set(postId, decision);
    if (decision) render(el, decision);
  }

  /** Re-evaluate already-checked visible posts when the Risk Score crosses a tier boundary.
   *  Uses the worker's cached verdict (no re-fact-check); the tier/wording reflect the new score. */
  async function reevaluateVisible(): Promise<void> {
    if (scanning) return;
    scanning = true;
    try {
      const posts = Array.from(document.querySelectorAll<HTMLElement>(POST_SELECTOR));
      for (const el of posts) {
        const postId = postIdOf(el);
        if (!decisions.has(postId)) continue; // only ones we've already checked
        const content = (el.innerText || "").trim();
        const res = await send({ type: "CHECK_POST", postId, content });
        if (!res || res.type !== "DECISION") continue;
        const decision = res.decision.shouldIntervene ? res.decision : null;
        const old = decisions.get(postId);
        decisions.set(postId, decision);
        const existing = el.querySelector(".xcheck-intervention");
        if (!decision) {
          existing?.remove(); // dropped below the floor -> remove the box
        } else if (!existing || old?.tier !== decision.tier) {
          existing?.remove();
          render(el, decision); // tier changed (or box missing) -> (re)render
        }
      }
    } finally {
      scanning = false;
    }
  }

  function start(): void {
    void safeScan();
    observe();
  }

  function stop(): void {
    observer.disconnect();
  }

  return { start, stop, reevaluateVisible };
}
