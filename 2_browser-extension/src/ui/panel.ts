// In-page X-Check panel (FR1 UX): a floating shield logo that opens a dark questionnaire for
// new users (auto-shown on first visit) and shows the saved profile + a "Redo test" option for
// returning users. Replaces the separate onboarding.html tab. All in-page, nothing uploaded.
import { ALL_ITEMS, POLITICAL_QUESTION } from "../profile/items";
import { hasAllMandatoryAnswers, scoreAnswers } from "../profile/scoring";
import { buildProfile } from "../profile/profile";
import { baselineFromProfile } from "../scoring/riskScore";
import { initialState } from "../scoring/learning";
import { STORAGE_KEYS } from "../storage/keys";
import { store } from "../storage/store";
import { aggregate } from "../dashboard/stats";
import { DashboardRange, DashboardSummary } from "../dashboard/types";
import {
  BLUE_SHIELD_ASSET,
  riskShieldForScore,
  SHIELD_ASSET_PATHS,
} from "./risk-shield";
import {
  AnswerValue,
  BigFiveTrait,
  PoliticalOrientation,
  QuestionnaireAnswers,
} from "../profile/types";

const SCALE = [1, 2, 3, 4, 5] as const;
const BIG_FIVE: BigFiveTrait[] = [
  "openness",
  "conscientiousness",
  "extraversion",
  "agreeableness",
  "neuroticism",
];
const LEVEL_COLOR: Record<string, string> = {
  high: "#e0245e",
  neutral: "#536471",
  low: "#1d9bf0",
};

interface RiskShieldLogo {
  element: HTMLElement;
  setScore(score: number | null | undefined): void;
}

export interface XCheckPanelDeps {
  /** Manual "Reset Not Interested" shield-menu action (see renderResults). Bypasses the
   *  remaining quiz cooldown without touching any other quiz/cooldown behaviour. Optional so
   *  existing callers/tests that don't care about the quiz feature keep working unchanged. */
  onResetQuizNotInterested?: () => Promise<void>;
}

let panelDeps: XCheckPanelDeps = {};

export async function initXCheckPanel(deps: XCheckPanelDeps = {}): Promise<void> {
  panelDeps = deps;
  if (document.getElementById("xcheck-logo")) return;
  injectStyles();
  const panel = createPanel();
  const logo = createLogo();
  document.body.appendChild(panel);
  document.body.appendChild(logo.element);

  logo.element.addEventListener("click", () => void onLogoClick(panel));
  syncLogoWithRiskScore(logo);

  // Brand-new user (no profile yet) -> auto-open the questionnaire.
  if (!(await store.getOnboardingComplete())) {
    renderQuestionnaire(panel);
    panel.classList.add("open");
  }
}

async function onLogoClick(panel: HTMLElement): Promise<void> {
  if (panel.classList.contains("open")) {
    panel.classList.remove("open");
    return;
  }
  if (await store.getOnboardingComplete()) {
    await renderResults(panel);
  } else {
    renderQuestionnaire(panel);
  }
  panel.classList.add("open");
}

function createLogo(): RiskShieldLogo {
  const logo = document.createElement("div");
  logo.id = "xcheck-logo";
  logo.title = "X-Check";
  logo.setAttribute("aria-label", "X-Check");

  const layers = [createShieldLayer(true), createShieldLayer(false)];
  logo.append(...layers);

  // The next shield is always decoded before the opacity change, so score updates never flash or
  // stall while a newly selected image loads.
  SHIELD_ASSET_PATHS.forEach((assetPath) => {
    const image = new Image();
    image.src = chrome.runtime.getURL(assetPath);
  });

  let activeLayerIndex = 0;
  let activeAssetPath = BLUE_SHIELD_ASSET;
  let transitionVersion = 0;

  return {
    element: logo,
    setScore(score) {
      const shield = riskShieldForScore(score);
      if (shield.assetPath === activeAssetPath) return;

      const current = layers[activeLayerIndex];
      const incoming = layers[1 - activeLayerIndex];
      const version = ++transitionVersion;
      const showIncoming = (): void => {
        if (version !== transitionVersion || incoming.dataset.assetPath !== shield.assetPath) return;
        window.requestAnimationFrame(() => {
          if (version !== transitionVersion) return;
          incoming.classList.add("is-visible");
          current.classList.remove("is-visible");
          activeLayerIndex = activeLayerIndex === 0 ? 1 : 0;
          activeAssetPath = shield.assetPath;
          logo.title = shield.label;
          logo.setAttribute("aria-label", shield.label);
        });
      };

      incoming.classList.remove("is-visible");
      incoming.dataset.assetPath = shield.assetPath;
      incoming.addEventListener("load", showIncoming, { once: true });
      incoming.src = chrome.runtime.getURL(shield.assetPath);
      if (incoming.complete && incoming.naturalWidth > 0) {
        incoming.removeEventListener("load", showIncoming);
        showIncoming();
      }
    },
  };
}

function createShieldLayer(isVisible: boolean): HTMLImageElement {
  const image = document.createElement("img");
  image.className = "xcheck-logo-layer";
  if (isVisible) image.classList.add("is-visible");
  image.alt = "";
  image.dataset.assetPath = BLUE_SHIELD_ASSET;
  image.src = chrome.runtime.getURL(BLUE_SHIELD_ASSET);
  return image;
}

function scoreFromRiskState(value: unknown): number | null {
  if (typeof value !== "object" || value === null) return null;
  const score = (value as { score?: unknown }).score;
  return typeof score === "number" && Number.isFinite(score) ? score : null;
}

function syncLogoWithRiskScore(logo: RiskShieldLogo): void {
  let receivedStorageUpdate = false;
  void store.getRiskState().then((state) => {
    // A storage event received while this initial read was pending is newer than the read.
    if (!receivedStorageUpdate) logo.setScore(state?.score);
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEYS.riskState] || !logo.element.isConnected) return;
    receivedStorageUpdate = true;
    logo.setScore(scoreFromRiskState(changes[STORAGE_KEYS.riskState].newValue));
  });
}

function createPanel(): HTMLElement {
  const panel = document.createElement("div");
  panel.className = "xcheck-panel";
  panel.addEventListener("click", (e) => e.stopPropagation());
  return panel;
}

function shell(title: string, bodyHtml: string): string {
  return (
    `<div class="xcheck-panel-header"><h2>${title}</h2>` +
    `<button class="xcheck-close" aria-label="Close">×</button></div>` +
    `<div class="xcheck-panel-body">${bodyHtml}</div>`
  );
}

function renderQuestionnaire(panel: HTMLElement): void {
  const items = ALL_ITEMS.map((item) => {
    const scale = SCALE.map(
      (n) =>
        `<label><input type="radio" name="${item.id}" value="${n}" /><span>${n}</span></label>`,
    ).join("");
    return `<div class="xcheck-q"><p>${item.text}</p><div class="xcheck-scale">${scale}</div></div>`;
  }).join("");

  const political =
    `<div class="xcheck-q"><p>${POLITICAL_QUESTION.text}</p>` +
    `<select class="xcheck-select" id="xcheck-political"><option value="">— skip —</option>` +
    POLITICAL_QUESTION.options
      .map((o) => `<option value="${o}">${o}</option>`)
      .join("") +
    `</select></div>`;

  panel.innerHTML = shell(
    "Quick questionnaire",
    `<p class="xcheck-intro">Answer 10 short questions (~2 min) so X-Check can tailor its ` +
      `warnings to you. 1 = strongly disagree, 5 = strongly agree. Your answers stay on this device.</p>` +
      `${items}${political}` +
      `<button class="xcheck-btn" id="xcheck-submit">Save profile</button>` +
      `<p class="xcheck-msg" id="xcheck-msg"></p>`,
  );

  wireClose(panel);
  panel
    .querySelector("#xcheck-submit")
    ?.addEventListener("click", () => void submit(panel));
}

async function submit(panel: HTMLElement): Promise<void> {
  const msg = panel.querySelector<HTMLElement>("#xcheck-msg");
  const answers: QuestionnaireAnswers = {};
  for (const item of ALL_ITEMS) {
    const checked = panel.querySelector<HTMLInputElement>(
      `input[name="${item.id}"]:checked`,
    );
    if (checked) answers[item.id] = Number(checked.value) as AnswerValue;
  }
  if (!hasAllMandatoryAnswers(answers)) {
    if (msg) {
      msg.style.color = "#e0245e";
      msg.textContent = "Please answer all questions.";
    }
    return;
  }

  const profile = buildProfile(scoreAnswers(answers));
  await store.setProfile(profile);
  await store.setRiskState(initialState(baselineFromProfile(profile)));

  const political = panel.querySelector<HTMLSelectElement>(
    "#xcheck-political",
  )?.value;
  if (political) await store.setPolitical(political as PoliticalOrientation);

  await store.setOnboardingComplete(true);
  await renderResults(panel, "Profile saved. X-Check is now tailored to you.");
}

async function renderResults(panel: HTMLElement, note = ""): Promise<void> {
  const profile = await store.getProfile();
  const political = await store.getPolitical();

  let rows = `<p class="xcheck-intro">No profile yet.</p>`;
  if (profile) {
    rows = BIG_FIVE.map((t) => traitRow(t, profile[t])).join("");
    if (profile.nfcc) rows += traitRow("need for closure", profile.nfcc);
  }
  const pol =
    `<div class="xcheck-result-row"><b>political</b>` +
    `<span class="xcheck-tag" style="background:#536471">${political ?? "—"}</span></div>`;

  // Optional: only rendered when content-script.ts wired a quiz injector in, so this panel keeps
  // working unchanged for any caller/test that doesn't supply it.
  const resetQuiz = panelDeps.onResetQuizNotInterested
    ? `<button class="xcheck-btn secondary" id="xcheck-reset-quiz">Reset "Not interested" quizzes</button>` +
      `<p class="xcheck-msg" id="xcheck-reset-quiz-msg"></p>`
    : "";

  panel.innerHTML = shell(
    "Your X-Check profile",
    (note ? `<p class="xcheck-intro" style="color:#1d9bf0">${note}</p>` : "") +
      rows +
      pol +
      `<button class="xcheck-btn" id="xcheck-stats">View my interactions</button>` +
      `<button class="xcheck-btn secondary" id="xcheck-redo">Redo test</button>` +
      resetQuiz,
  );

  wireClose(panel);
  panel
    .querySelector("#xcheck-stats")
    ?.addEventListener("click", () => void renderStats(panel));
  panel
    .querySelector("#xcheck-redo")
    ?.addEventListener("click", () => renderQuestionnaire(panel));
  panel
    .querySelector("#xcheck-reset-quiz")
    ?.addEventListener("click", (e) => void onResetQuizClick(panel, e.currentTarget as HTMLButtonElement));
}

/** "Reset Not Interested": manually bypass the quiz cooldown so suppressed quiz cards become
 *  eligible again immediately. Does not touch the profile, risk state, or any other panel data —
 *  only the quiz cooldown that "Not interested" set. */
async function onResetQuizClick(panel: HTMLElement, button: HTMLButtonElement): Promise<void> {
  const msg = panel.querySelector<HTMLElement>("#xcheck-reset-quiz-msg");
  button.disabled = true;
  try {
    await panelDeps.onResetQuizNotInterested?.();
    if (msg) {
      msg.style.color = "#1d9bf0";
      msg.textContent = "Quiz cards can appear again.";
    }
  } finally {
    button.disabled = false;
  }
}

// ---- Interaction stats view ----
const STATS_RANGES: { id: DashboardRange; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
];
const STATS_ACTIONS: { type: string; label: string; color: string }[] = [
  { type: "SHARE_FLAGGED", label: "Shared a flagged post", color: "#e0245e" },
  { type: "LIKE_FLAGGED", label: "Liked a flagged post", color: "#e0245e" },
  { type: "DISMISS_INTERVENTION", label: "Dismissed the warning", color: "#e0245e" },
  { type: "CLICK_TRUSTED_SOURCE", label: "Opened a source", color: "#1d9bf0" },
  { type: "READ_EXPANDED_WARNING", label: "Read the warning", color: "#1d9bf0" },
];
let statsRange: DashboardRange = "today";

async function renderStats(panel: HTMLElement): Promise<void> {
  const summary = aggregate(await store.getInteractionLog(), statsRange, Date.now());

  const seg = STATS_RANGES.map(
    (r) =>
      `<button class="xcheck-seg-btn${r.id === statsRange ? " active" : ""}" ` +
      `data-range="${r.id}">${r.label}</button>`,
  ).join("");

  const body =
    summary.seen === 0
      ? `<p class="xcheck-intro">No flagged posts seen in this period yet. Browse the feed so ` +
        `X-Check can show warnings, then check back here.</p>`
      : statsHero(summary) + statsBars(summary);

  panel.innerHTML = shell(
    "Your interactions",
    `<div class="xcheck-seg">${seg}</div>${body}` +
      `<button class="xcheck-btn secondary" id="xcheck-back">Back to profile</button>`,
  );

  wireClose(panel);
  panel.querySelectorAll<HTMLElement>(".xcheck-seg-btn").forEach((btn) =>
    btn.addEventListener("click", () => {
      statsRange = (btn.dataset.range as DashboardRange) ?? "today";
      void renderStats(panel);
    }),
  );
  panel
    .querySelector("#xcheck-back")
    ?.addEventListener("click", () => void renderResults(panel));
}

function statsHero(s: DashboardSummary): string {
  const noun = s.seen === 1 ? "flagged post" : "flagged posts";
  return (
    `<div class="xcheck-hero"><span class="xcheck-hero-num">${s.seen}</span>` +
    `<span class="xcheck-hero-label">${noun} seen — bars are out of this total</span></div>`
  );
}

function statsBars(s: DashboardSummary): string {
  return STATS_ACTIONS.map((a) => {
    const count = Math.max(0, s.byType[a.type] ?? 0);
    const pct = s.seen > 0 ? Math.min(100, (count / s.seen) * 100) : 0;
    return (
      `<div class="xcheck-bar-row"><div class="xcheck-bar-head"><span>${a.label}</span>` +
      `<span class="xcheck-bar-val">${count} / ${s.seen} · ${Math.round(pct)}%</span></div>` +
      `<div class="xcheck-bar-track">` +
      `<div class="xcheck-bar-fill" style="width:${pct}%;background:${a.color}"></div>` +
      `</div></div>`
    );
  }).join("");
}

function traitRow(label: string, level: string): string {
  return (
    `<div class="xcheck-result-row"><b>${label}</b>` +
    `<span class="xcheck-tag" style="background:${LEVEL_COLOR[level] ?? "#536471"}">${level}</span></div>`
  );
}

function wireClose(panel: HTMLElement): void {
  panel
    .querySelector(".xcheck-close")
    ?.addEventListener("click", () => panel.classList.remove("open"));
}

function injectStyles(): void {
  if (document.getElementById("xcheck-styles")) return;
  const style = document.createElement("style");
  style.id = "xcheck-styles";
  style.textContent = `
  #xcheck-logo{position:fixed;bottom:20px;right:20px;width:96px;height:96px;border-radius:50%;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.45);z-index:2147483646;transition:transform .15s}
  #xcheck-logo:hover{transform:scale(1.08)}
  #xcheck-logo .xcheck-logo-layer{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;border-radius:50%;opacity:0;pointer-events:none;transition:opacity 160ms ease-in-out}
  #xcheck-logo .xcheck-logo-layer.is-visible{opacity:1}
  @media (prefers-reduced-motion: reduce){#xcheck-logo .xcheck-logo-layer{transition:none}}
  .xcheck-panel{position:fixed;bottom:132px;right:20px;width:360px;max-height:76vh;overflow-y:auto;background:#15202b;color:#fff;border:1px solid #2f3b47;border-radius:16px;box-shadow:0 10px 36px rgba(0,0,0,.55);z-index:2147483647;font-family:system-ui,-apple-system,Arial,sans-serif;display:none}
  .xcheck-panel.open{display:block}
  .xcheck-panel-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px;border-bottom:1px solid #2f3b47;position:sticky;top:0;background:#15202b}
  .xcheck-panel-header h2{margin:0;font-size:15px;color:#1d9bf0}
  .xcheck-close{background:none;border:none;color:#8899a6;font-size:22px;line-height:1;cursor:pointer}
  .xcheck-panel-body{padding:14px 16px}
  .xcheck-intro{font-size:12px;color:#8899a6;margin:0 0 14px;line-height:1.5}
  .xcheck-q{margin:0 0 16px}
  .xcheck-q p{margin:0 0 8px;font-size:13px;color:#e7e9ea}
  .xcheck-scale{display:flex;gap:6px}
  .xcheck-scale label{flex:1}
  .xcheck-scale input{position:absolute;opacity:0;pointer-events:none}
  .xcheck-scale span{display:block;text-align:center;padding:7px 0;border:1px solid #38444d;border-radius:8px;font-size:13px;color:#cfd9de;cursor:pointer}
  .xcheck-scale input:checked+span{background:#1d9bf0;border-color:#1d9bf0;color:#fff}
  .xcheck-select{width:100%;padding:9px;background:#000;color:#fff;border:1px solid #38444d;border-radius:8px;font-size:13px}
  .xcheck-btn{width:100%;padding:11px;background:#1d9bf0;color:#fff;border:none;border-radius:999px;font-weight:600;font-size:14px;cursor:pointer;margin-top:6px}
  .xcheck-btn.secondary{background:transparent;border:1px solid #38444d}
  .xcheck-msg{font-size:12px;margin-top:10px}
  .xcheck-result-row{display:flex;align-items:center;justify-content:space-between;padding:9px 0;border-bottom:1px solid #2f3b47;font-size:13px}
  .xcheck-result-row b{font-weight:600;color:#e7e9ea;text-transform:capitalize}
  .xcheck-tag{padding:2px 10px;border-radius:999px;font-size:12px;color:#fff;text-transform:capitalize}
  .xcheck-seg{display:flex;gap:6px;margin-bottom:16px}
  .xcheck-seg-btn{flex:1;padding:7px 0;background:transparent;border:1px solid #38444d;border-radius:999px;color:#cfd9de;font-size:12px;font-weight:600;cursor:pointer}
  .xcheck-seg-btn.active{background:#1d9bf0;border-color:#1d9bf0;color:#fff}
  .xcheck-hero{display:flex;align-items:baseline;gap:10px;margin-bottom:16px}
  .xcheck-hero-num{font-size:28px;font-weight:700;color:#1d9bf0}
  .xcheck-hero-label{font-size:12px;color:#8899a6}
  .xcheck-bar-row{margin:0 0 14px}
  .xcheck-bar-head{display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;color:#e7e9ea}
  .xcheck-bar-val{color:#8899a6;font-variant-numeric:tabular-nums}
  .xcheck-bar-track{height:10px;background:#0e1620;border-radius:999px;overflow:hidden}
  .xcheck-bar-fill{height:100%;border-radius:999px;min-width:2px;transition:width .25s ease}
  `;
  document.head.appendChild(style);
}
