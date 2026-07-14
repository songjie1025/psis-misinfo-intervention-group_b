// ---- FRONT-END SEAM ----
// Everything in this file is the intervention UI. It switches on decision.tier:
//   T1 -> a small label ONLY: the verdict (false / misleading / …) with NO context or sources.
//   T2 -> a fuller label: the verdict, an explanation paragraph, AND clickable sources.
//   T3 -> currently identical to T2.
// Every tier carries a dismiss (×) button. Dismissal is EPHEMERAL: the scanner drops the box for
// this page load but does not persist it, so a refresh brings the intervention back.
// content-script wires it in by passing `renderDecision` to the post scanner.
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
