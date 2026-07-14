// ---- FRONT-END SEAM ----
// Everything in this file is the intervention UI. It switches on decision.tier:
//   T1 -> a small label ONLY: the verdict (false / misleading / …) with NO context or sources.
//   T2 -> a fuller label: the verdict, an explanation paragraph, AND clickable sources.
//   T3 -> the same visible label as T2, plus a click-blocking gate for share/like/comment.
// Every tier carries a dismiss (×) button. Dismissal is EPHEMERAL: the scanner drops the box for
// this page load but does not persist it, so a refresh brings the intervention back.
// content-script wires it in by passing `renderDecision` to the post scanner.
import { POST_SELECTOR } from "./constants";
import { makeEvent } from "../../scoring/behaviour";
import { BehaviourEvent } from "../../scoring/types";
import { InterventionDecision } from "../../interventions/types";

const VERDICT_COLOR: Record<string, string> = {
  FALSE: "#e0245e",
  MISLEADING: "#ff7a00",
  DISPUTED: "#f4b400",
  UNVERIFIED: "#536471",
};

// Short, context-free label shown at every tier (this is ALL a T1 intervention gets).
const VERDICT_LABEL: Record<string, string> = {
  FALSE: "This information is false.",
  MISLEADING: "This information is misleading.",
  DISPUTED: "This information is disputed.",
  UNVERIFIED: "This information is unverified.",
};

// Tier 3 gate
const TIER3_ACTION_SELECTOR =
  "[data-xcheck-like], [data-xcheck-share], [data-xcheck-comment]";
const TIER3_OVERLAY_ID = "xcheck-tier3-gate";
const TIER3_STYLE_ID = "xcheck-tier3-gate-styles";

let tier3GateInstalled = false;
let tier3Overlay: HTMLElement | null = null;
let tier3Button: HTMLElement | null = null;
let tier3RemainingMs = 3000;
let tier3Timer: number | null = null;
let tier3PreviousBodyOverflow = "";
const tier3ReplayTargets = new WeakSet<HTMLElement>();

function ensureTier3Gate(): void {
  if (tier3GateInstalled) return;
  tier3GateInstalled = true;
  ensureTier3Styles();
  document.addEventListener("click", onTier3Click, true);
}

function stopTier3Timer(): void {
  if (tier3Timer !== null) {
    clearInterval(tier3Timer);
    tier3Timer = null;
  }
}

function closeTier3Overlay(): void {
  stopTier3Timer();
  tier3Overlay?.remove();
  tier3Overlay = null;
  tier3Button = null;
  document.body.style.overflow = tier3PreviousBodyOverflow;
}

function replayTier3Action(target: HTMLElement | null): void {
  if (!target) return;
  tier3ReplayTargets.add(target);
  target.click();
}

function updateTier3OverlayText(): void {
  if (!tier3Overlay) return;
  const text = tier3Overlay.querySelector<HTMLElement>("[data-xcheck-tier3-countdown]");
  if (text) {
    text.textContent =
      tier3RemainingMs > 0
        ? `Please wait ${Math.ceil(tier3RemainingMs / 1000)} seconds.`
        : "You can proceed now.";
  }
  const proceed = tier3Overlay.querySelector<HTMLButtonElement>("[data-xcheck-tier3-proceed]");
  if (proceed) {
    proceed.disabled = tier3RemainingMs > 0;
    proceed.textContent =
      tier3RemainingMs > 0
        ? `Please wait (${Math.ceil(tier3RemainingMs / 1000)})`
        : "Continue action";
  }
}

  // Show the overlay (popup) and start the countdown timer.
  // The user can cancel or wait for the timer to finish before proceeding.
function openTier3Overlay(target: HTMLElement): void {
  closeTier3Overlay();
  tier3Button = target;
  tier3RemainingMs = 3000;
  tier3PreviousBodyOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  tier3Overlay = document.createElement("div");
  tier3Overlay.id = TIER3_OVERLAY_ID;
  tier3Overlay.innerHTML = `
    <div class="xcheck-tier3-card" role="dialog" aria-modal="true" aria-labelledby="xcheck-tier3-title">
      <div class="xcheck-tier3-badge">T3</div>
      <h2 id="xcheck-tier3-title">Are you really sure?</h2>
      <p>This action is currently blocked for this post. Please take a moment to consider whether you really want to proceed.</p>
      <p data-xcheck-tier3-countdown></p>
      <div class="xcheck-tier3-actions">
        <button type="button" class="xcheck-tier3-secondary" data-xcheck-tier3-cancel>Cancel</button>
        <button type="button" class="xcheck-tier3-primary" data-xcheck-tier3-proceed disabled>Please wait (${Math.ceil(tier3RemainingMs / 1000)})</button>
      </div>
    </div>
  `;

  tier3Overlay.addEventListener("click", (e) => {
    if (e.target === tier3Overlay) closeTier3Overlay();
  });
  tier3Overlay.querySelector("[data-xcheck-tier3-cancel]")?.addEventListener("click", closeTier3Overlay);
  tier3Overlay.querySelector("[data-xcheck-tier3-proceed]")?.addEventListener("click", () => {
    if (tier3RemainingMs > 0) return;
    const currentTarget = tier3Button;
    closeTier3Overlay();
    replayTier3Action(currentTarget);
  });

  document.body.appendChild(tier3Overlay);
  updateTier3OverlayText();

  tier3Timer = window.setInterval(() => {
    tier3RemainingMs = Math.max(0, tier3RemainingMs - 250);
    updateTier3OverlayText();
    if (tier3RemainingMs <= 0) stopTier3Timer();
  }, 250);
}

// Intercept clicks on like/share/comment buttons for T3 posts and
// show the overlay instead of proceeding.
function onTier3Click(e: MouseEvent): void {
  const target = e.target as HTMLElement | null;
  if (!target) return;
  if (tier3Overlay && target.closest(`#${TIER3_OVERLAY_ID}`)) return;

  const action = target.closest<HTMLElement>(TIER3_ACTION_SELECTOR);
  if (!action) return;

  if (tier3ReplayTargets.has(action)) {
    tier3ReplayTargets.delete(action);
    return;
  }

  const post = action.closest<HTMLElement>(POST_SELECTOR);
  if (!post) return;
  if (!post.querySelector(".xcheck-T3")) return;

  e.preventDefault();
  e.stopPropagation();
  e.stopImmediatePropagation();
  openTier3Overlay(action);
}

// CSS styles for the overlay and card are injected into the page.
function ensureTier3Styles(): void {
  if (document.getElementById(TIER3_STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = TIER3_STYLE_ID;
  style.textContent = `
    #${TIER3_OVERLAY_ID} {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.62);
      z-index: 2147483647;
      padding: 20px;
    }

    #${TIER3_OVERLAY_ID} .xcheck-tier3-card {
      width: min(440px, 100%);
      background: #15202b;
      color: #e7e9ea;
      border: 1px solid #1d9bf0;
      border-radius: 18px;
      padding: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
      font-family: system-ui, -apple-system, Arial, sans-serif;
    }

    #${TIER3_OVERLAY_ID} .xcheck-tier3-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 42px;
      height: 24px;
      padding: 0 10px;
      border-radius: 999px;
      background: #e0245e;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 12px;
    }

    #${TIER3_OVERLAY_ID} h2 {
      margin: 0 0 10px;
      font-size: 20px;
      line-height: 1.2;
    }

    #${TIER3_OVERLAY_ID} p {
      margin: 0 0 12px;
      color: #cfd9de;
      line-height: 1.5;
      font-size: 14px;
    }

    #${TIER3_OVERLAY_ID} [data-xcheck-tier3-countdown] {
      color: #1d9bf0;
      font-weight: 600;
      min-height: 1.5em;
    }

    #${TIER3_OVERLAY_ID} .xcheck-tier3-actions {
      display: flex;
      gap: 10px;
      margin-top: 18px;
    }

    #${TIER3_OVERLAY_ID} button {
      flex: 1;
      border: 0;
      border-radius: 999px;
      padding: 11px 14px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
    }

    #${TIER3_OVERLAY_ID} .xcheck-tier3-secondary {
      background: transparent;
      border: 1px solid #38444d;
      color: #e7e9ea;
    }

    #${TIER3_OVERLAY_ID} .xcheck-tier3-primary {
      background: #1d9bf0;
      color: #fff;
    }

    #${TIER3_OVERLAY_ID} .xcheck-tier3-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  document.head.appendChild(style);
}

/**
 * Render the intervention box onto a post.
 * `emit` reports a behaviour signal when the box (or a source link) is clicked.
 * `onDismiss` is called when the user hits the × button; the scanner uses it to drop the box for
 * this page load only (ephemeral — returns on refresh).
 */
export function renderDecision(
  el: HTMLElement,
  decision: InterventionDecision,
  emit: (event: BehaviourEvent) => void,
  onDismiss: () => void,
): void {
  el.dataset.xcheckFlagged = "true"; // so liking/sharing this post counts (FR4)
  if (el.querySelector(".xcheck-intervention")) return;
  if (decision.tier === "T3") ensureTier3Gate();

  const color = VERDICT_COLOR[decision.verdictLabel] ?? "#536471";
  const label = VERDICT_LABEL[decision.verdictLabel] ?? "This information is disputed.";
  const full = decision.tier !== "T1"; // T2/T3 get the explanation + sources

  const box = document.createElement("div");
  box.className = `xcheck-intervention xcheck-${decision.tier}`;
  Object.assign(box.style, {
    position: "relative",
    margin: "8px 0",
    padding: full ? "10px 12px" : "8px 34px 8px 12px",
    borderRadius: "12px",
    border: `1px solid ${color}`,
    background: "rgba(224,36,94,0.08)",
    color: "#e7e9ea",
    fontSize: "13px",
    lineHeight: "1.5",
  } satisfies Partial<CSSStyleDeclaration>);

  if (full) {
    const sources = decision.sources
      .filter((s) => s.url.startsWith("http"))
      .map(
        (s) =>
          `<a href="${s.url}" target="_blank" rel="noopener" style="color:#1d9bf0;text-decoration:none">${escapeHtml(s.publisherName)}</a>`,
      )
      .join(" \u00b7 ");

    box.innerHTML =
      `<div style="display:flex;gap:8px;align-items:center;margin-bottom:6px">` +
      `<span style="background:${color};color:#fff;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700">${decision.verdictLabel}</span>` +
      `<span style="color:#8899a6;font-size:11px">${decision.tier} \u00b7 X-Check</span></div>` +
      `<div style="font-weight:700;margin-bottom:4px">${label}</div>` +
      (decision.headline ? `<div>${escapeHtml(decision.headline)}</div>` : "") +
      (sources
        ? `<div style="margin-top:6px;font-size:12px;color:#8899a6">Sources: ${sources}</div>`
        : "");
  } else {
    // T1: verdict pill + short label only. No explanation, no sources.
    box.innerHTML =
      `<div style="display:flex;gap:8px;align-items:center">` +
      `<span style="background:${color};color:#fff;padding:1px 8px;border-radius:999px;font-size:11px;font-weight:700">${decision.verdictLabel}</span>` +
      `<span style="font-weight:600">${label}</span></div>`;
  }

  box.appendChild(
    makeDismissButton(() => {
      // Dismissing = ignoring the warning, so it nudges the Risk Score UP (FR4). The scanner then
      // drops the box for this page load (ephemeral).
      emit(makeEvent("DISMISS_INTERVENTION", decision.postId));
      onDismiss();
    }),
  );
  el.prepend(box);

  box.addEventListener("click", (e) => {
    // The box lives inside the post <article>, whose click handler opens the post detail view.
    // Stop the event here so interacting with the intervention (incl. opening a source in a new
    // tab) never navigates the feed. Source links still open because we don't preventDefault.
    e.stopPropagation();
    if ((e.target as HTMLElement).closest(".xcheck-dismiss")) return; // handled by its own listener
    const link = (e.target as HTMLElement).closest("a");
    emit(makeEvent(link ? "CLICK_TRUSTED_SOURCE" : "READ_EXPANDED_WARNING", decision.postId));
  });
}

function makeDismissButton(onDismiss: () => void): HTMLElement {
  const btn = document.createElement("button");
  btn.className = "xcheck-dismiss";
  btn.type = "button";
  btn.setAttribute("aria-label", "Dismiss");
  btn.textContent = "\u00d7"; // ×
  Object.assign(btn.style, {
    position: "absolute",
    top: "6px",
    right: "8px",
    width: "20px",
    height: "20px",
    padding: "0",
    lineHeight: "18px",
    textAlign: "center",
    border: "none",
    borderRadius: "999px",
    background: "transparent",
    color: "#8899a6",
    fontSize: "16px",
    cursor: "pointer",
  } satisfies Partial<CSSStyleDeclaration>);
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    onDismiss();
  });
  return btn;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// ---- END FRONT-END SEAM ----
