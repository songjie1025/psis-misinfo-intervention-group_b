// Shared constants + helpers for the content-script components.
export const POST_SELECTOR = "[data-xcheck-post]";
export const SHORT_DWELL_MS = 1500;
export const LONG_DWELL_MS = 4000;
export const FAST_SCROLL_PX_PER_S = 2000;
export const CHECK_DELAY_MS = 1500;

/** Stable id for a post element: the explicit data-id, else a slice of its text. */
export function postIdOf(el: HTMLElement): string {
  return el.dataset.xcheckPostId || (el.innerText || "").trim().slice(0, 32);
}
