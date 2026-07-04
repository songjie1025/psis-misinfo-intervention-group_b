// Always-on debug HUD (dev only). Renders a fixed panel on the page that mirrors ALL of the
// implemented risk-score logic so we can watch it live during demos / debugging:
//   - the live Risk Score + band + tier zone, on a bar with the band/tier cut-points marked
//   - a rolling event log (each event, its weight, and the score it produced)
//   - live dwell / scroll-velocity meters against their thresholds
//   - a static legend of every model constant (weights, decay, passive cap, thresholds)
// It imports the real constants/functions from the scoring modules so it can never drift from
// the actual behaviour — it is a *view*, it does not re-implement the maths.
import { BehaviourEvent, BehaviourEventType } from "../../scoring/types";
import { EVENT_WEIGHTS } from "../../scoring/behaviour";
import {
  bandFor,
  NEUTRAL_BASELINE,
  LOW_BAND_MAX,
  MEDIUM_BAND_MAX,
  SCORE_MAX,
} from "../../scoring/riskScore";
import {
  tierForScore,
  NO_INTERVENTION_MAX,
  T1_MAX,
  T2_MAX,
} from "../../interventions/selector";
import {
  DECAY_PER_MS,
  PASSIVE_CAP_PER_WINDOW,
  PASSIVE_WINDOW_MS,
} from "../../scoring/learning";
import {
  SHORT_DWELL_MS,
  LONG_DWELL_MS,
  FAST_SCROLL_PX_PER_S,
} from "./constants";

export interface HudMetrics {
  /** Current dwell time (ms) on the post the user is looking at, 0 when none. */
  dwellMs: number;
  /** Most recent scroll velocity (px/s). */
  velocity: number;
}

export interface BehaviourHud {
  /** Record a behaviour event and the resulting live score, updating the whole HUD. */
  logEvent(event: BehaviourEvent, score: number): void;
  /** Update the live dwell / scroll meters (called on a fast sampler). */
  setMetrics(metrics: HudMetrics): void;
}

const MAX_LOG_ROWS = 12;
const POSITIVE_COLOR = "#ff5a5f"; // raises score (more vulnerable)
const NEGATIVE_COLOR = "#2ec26a"; // lowers score (more reflective)

function bandColor(band: string): string {
  if (band === "low") return "#2ec26a";
  if (band === "medium") return "#f5a623";
  return "#ff5a5f";
}

function signed(n: number): string {
  return n >= 0 ? `+${n}` : `${n}`;
}

/** Pretty, compact label for an event type. */
function eventLabel(type: BehaviourEventType): string {
  return type.replace(/_/g, " ").toLowerCase();
}

export function createBehaviourHud(): BehaviourHud {
  let score = NEUTRAL_BASELINE;
  const rows: string[] = [];

  const root = document.createElement("div");
  root.className = "xcheck-hud";
  root.style.cssText = [
    "position:fixed",
    "top:12px",
    "right:12px",
    "width:300px",
    "max-height:calc(100vh - 24px)",
    "overflow:auto",
    "z-index:2147483647",
    "background:rgba(17,20,24,0.94)",
    "color:#e7ecf1",
    "font:11px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace",
    "border:1px solid #2b3038",
    "border-radius:10px",
    "box-shadow:0 8px 28px rgba(0,0,0,0.45)",
    "padding:10px 12px",
    "user-select:none",
  ].join(";");

  // --- header: live score / band / tier ---
  const header = document.createElement("div");
  const bar = document.createElement("div");
  const barFill = document.createElement("div");
  const ticks = document.createElement("div");

  bar.style.cssText =
    "position:relative;height:10px;border-radius:5px;background:#20252c;margin:8px 0 2px;overflow:hidden";
  barFill.style.cssText =
    "position:absolute;left:0;top:0;bottom:0;width:0;transition:width .15s,background .15s";
  bar.appendChild(barFill);

  ticks.style.cssText = "position:relative;height:12px;font-size:9px;color:#8b95a1";
  // Tick marks for every cut-point in the model.
  const cutPoints: Array<[number, string]> = [
    [NO_INTERVENTION_MAX, "T1"],
    [LOW_BAND_MAX, "band"],
    [T1_MAX, "T2"],
    [MEDIUM_BAND_MAX, "band"],
    [T2_MAX, "T3"],
  ];
  for (const [value, label] of cutPoints) {
    const t = document.createElement("div");
    t.style.cssText = `position:absolute;left:${(value / SCORE_MAX) * 100}%;top:0;transform:translateX(-50%);white-space:nowrap`;
    t.textContent = `${label}·${value}`;
    ticks.appendChild(t);
  }

  // --- live meters ---
  const meters = document.createElement("div");
  meters.style.cssText = "margin:8px 0;padding:6px 0;border-top:1px solid #2b3038";

  // --- event log ---
  const logTitle = document.createElement("div");
  logTitle.textContent = "EVENT LOG (event · weight · score)";
  logTitle.style.cssText =
    "margin:8px 0 4px;color:#8b95a1;letter-spacing:.04em;border-top:1px solid #2b3038;padding-top:8px";
  const log = document.createElement("div");
  log.style.cssText = "display:flex;flex-direction:column;gap:2px";

  // --- static legend of the model constants ---
  const legend = document.createElement("div");
  legend.style.cssText =
    "margin-top:8px;padding-top:8px;border-top:1px solid #2b3038;color:#aab4bf";
  legend.innerHTML = buildLegendHtml();

  root.appendChild(header);
  root.appendChild(bar);
  root.appendChild(ticks);
  root.appendChild(meters);
  root.appendChild(logTitle);
  root.appendChild(log);
  root.appendChild(legend);

  function mount(): void {
    if (document.body) document.body.appendChild(root);
    else window.addEventListener("DOMContentLoaded", () => document.body.appendChild(root));
  }

  function renderHeader(): void {
    const band = bandFor(score);
    const tier = tierForScore(score);
    header.innerHTML =
      `<div style="display:flex;align-items:baseline;justify-content:space-between">` +
      `<strong style="font-size:13px;letter-spacing:.05em">X-CHECK RISK HUD</strong>` +
      `<span style="font-size:20px;font-weight:700;color:${bandColor(band)}">${score}</span>` +
      `</div>` +
      `<div style="color:#8b95a1">band <b style="color:${bandColor(band)}">${band}</b>` +
      ` · tier <b style="color:#e7ecf1">${tier ?? "none"}</b>` +
      ` · baseline ${NEUTRAL_BASELINE}</div>`;
    barFill.style.width = `${(score / SCORE_MAX) * 100}%`;
    barFill.style.background = bandColor(band);
  }

  function renderMeters(m: HudMetrics): void {
    const dwellPct = Math.min(100, (m.dwellMs / LONG_DWELL_MS) * 100);
    const velPct = Math.min(100, (m.velocity / FAST_SCROLL_PX_PER_S) * 100);
    const dwellState =
      m.dwellMs === 0
        ? "—"
        : m.dwellMs < SHORT_DWELL_MS
          ? "short"
          : m.dwellMs >= LONG_DWELL_MS
            ? "long"
            : "neutral";
    const velState = m.velocity > FAST_SCROLL_PX_PER_S ? "FAST" : "ok";
    meters.innerHTML =
      meterRow(
        "dwell",
        `${(m.dwellMs / 1000).toFixed(1)}s (${dwellState})`,
        dwellPct,
        m.dwellMs >= LONG_DWELL_MS ? NEGATIVE_COLOR : POSITIVE_COLOR,
      ) +
      meterRow(
        "scroll",
        `${Math.round(m.velocity)}px/s (${velState})`,
        velPct,
        m.velocity > FAST_SCROLL_PX_PER_S ? POSITIVE_COLOR : "#5b93d6",
      );
  }

  function renderLog(): void {
    log.innerHTML = rows.join("");
  }

  function logEvent(event: BehaviourEvent, newScore: number): void {
    score = newScore;
    const weight = EVENT_WEIGHTS[event.type] ?? 0;
    const color = weight >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;
    const valuePart =
      event.value !== undefined ? ` <span style="color:#6c7783">(${event.value})</span>` : "";
    const row =
      `<div style="display:flex;justify-content:space-between;gap:6px">` +
      `<span style="color:#cdd5de">${eventLabel(event.type)}${valuePart}</span>` +
      `<span><b style="color:${color}">${signed(weight)}</b> ` +
      `<span style="color:#8b95a1">→ ${score}</span></span>` +
      `</div>`;
    rows.unshift(row);
    if (rows.length > MAX_LOG_ROWS) rows.pop();
    renderHeader();
    renderLog();
  }

  function setMetrics(m: HudMetrics): void {
    renderMeters(m);
  }

  mount();
  renderHeader();
  renderMeters({ dwellMs: 0, velocity: 0 });

  return { logEvent, setMetrics };
}

function meterRow(name: string, value: string, pct: number, color: string): string {
  return (
    `<div style="margin:2px 0">` +
    `<div style="display:flex;justify-content:space-between"><span style="color:#8b95a1">${name}</span><span>${value}</span></div>` +
    `<div style="height:5px;border-radius:3px;background:#20252c;overflow:hidden;margin-top:2px">` +
    `<div style="height:100%;width:${pct}%;background:${color}"></div></div>` +
    `</div>`
  );
}

function buildLegendHtml(): string {
  const weights = (Object.keys(EVENT_WEIGHTS) as BehaviourEventType[])
    .sort((a, b) => EVENT_WEIGHTS[b] - EVENT_WEIGHTS[a])
    .map((t) => {
      const w = EVENT_WEIGHTS[t];
      const color = w >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;
      return (
        `<div style="display:flex;justify-content:space-between">` +
        `<span>${eventLabel(t)}</span><b style="color:${color}">${signed(w)}</b></div>`
      );
    })
    .join("");

  const decayPerMin = Math.round(DECAY_PER_MS * 60000 * 100) / 100;
  return (
    `<div style="color:#8b95a1;letter-spacing:.04em;margin-bottom:4px">MODEL (event weights)</div>` +
    weights +
    `<div style="color:#8b95a1;letter-spacing:.04em;margin:6px 0 4px">CONSTANTS</div>` +
    `<div>decay → ${NEUTRAL_BASELINE}: ${decayPerMin}/min</div>` +
    `<div>passive cap: ${PASSIVE_CAP_PER_WINDOW}/${PASSIVE_WINDOW_MS / 1000}s window</div>` +
    `<div>bands: low ≤${LOW_BAND_MAX} · med ≤${MEDIUM_BAND_MAX} · high &gt;${MEDIUM_BAND_MAX}</div>` +
    `<div>tiers: none ≤${NO_INTERVENTION_MAX} · T1 ≤${T1_MAX} · T2 ≤${T2_MAX} · T3 &gt;${T2_MAX}</div>` +
    `<div>dwell: short &lt;${SHORT_DWELL_MS / 1000}s · long ≥${LONG_DWELL_MS / 1000}s</div>` +
    `<div>fast scroll: &gt;${FAST_SCROLL_PX_PER_S}px/s</div>`
  );
}
