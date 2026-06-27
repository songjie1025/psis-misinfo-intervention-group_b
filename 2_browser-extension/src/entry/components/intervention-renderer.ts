// ---- FRONT-END SEAM ----
// Everything in this file is the placeholder intervention UI. The front-end owner replaces THIS
// FILE with the real T1/T2/T3 design, switching on decision.tier. content-script wires it in by
// passing `renderDecision` to the post scanner; nothing outside this file needs to change.
import { makeEvent } from "../../scoring/behaviour";
import { BehaviourEvent } from "../../scoring/types";
import { InterventionDecision } from "../../interventions/types";

const VERDICT_COLOR: Record<string, string> = {
  FALSE: "#e0245e",
  MISLEADING: "#ff7a00",
  DISPUTED: "#f4b400",
  UNVERIFIED: "#536471",
};

/**
 * Render the intervention box onto a post. `emit` lets a click on the box (or a source link)
 * report a behaviour signal back to the scoring loop.
 */
export function renderDecision(
  el: HTMLElement,
  decision: InterventionDecision,
  emit: (event: BehaviourEvent) => void,
): void {
  el.dataset.xcheckFlagged = "true"; // so liking/sharing this post counts (FR4)
  if (el.querySelector(".xcheck-intervention")) return;

  const color = VERDICT_COLOR[decision.verdictLabel] ?? "#536471";
  const box = document.createElement("div");
  box.className = `xcheck-intervention xcheck-${decision.tier}`;
  Object.assign(box.style, {
    margin: "8px 0",
    padding: "10px 12px",
    borderRadius: "12px",
    border: `1px solid ${color}`,
    background: "rgba(224,36,94,0.08)",
    color: "#e7e9ea",
    fontSize: "13px",
    lineHeight: "1.5",
  } satisfies Partial<CSSStyleDeclaration>);

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
    `<div style="font-weight:700;margin-bottom:${decision.body ? "4px" : "0"}">${escapeHtml(decision.headline)}</div>` +
    (decision.body ? `<div>${escapeHtml(decision.body)}</div>` : "") +
    (sources ? `<div style="margin-top:6px;font-size:12px;color:#8899a6">Sources: ${sources}</div>` : "");

  el.prepend(box);

  box.addEventListener("click", (e) => {
    const link = (e.target as HTMLElement).closest("a");
    emit(makeEvent(link ? "CLICK_TRUSTED_SOURCE" : "READ_EXPANDED_WARNING", decision.postId));
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// ---- END FRONT-END SEAM ----
