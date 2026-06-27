// In-page X-Check panel (FR1 UX): a floating shield logo that opens a dark questionnaire for
// new users (auto-shown on first visit) and shows the saved profile + a "Redo test" option for
// returning users. Replaces the separate onboarding.html tab. All in-page, nothing uploaded.
import { ALL_ITEMS, POLITICAL_QUESTION } from "../profile/items";
import { hasAllMandatoryAnswers, scoreAnswers } from "../profile/scoring";
import { buildProfile } from "../profile/profile";
import { baselineFromProfile } from "../scoring/riskScore";
import { initialState } from "../scoring/learning";
import { store } from "../storage/store";
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

export async function initXCheckPanel(): Promise<void> {
  if (document.getElementById("xcheck-logo")) return;
  injectStyles();
  const panel = createPanel();
  const logo = createLogo();
  document.body.appendChild(panel);
  document.body.appendChild(logo);

  logo.addEventListener("click", () => void onLogoClick(panel));

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

function createLogo(): HTMLElement {
  const logo = document.createElement("div");
  logo.id = "xcheck-logo";
  logo.title = "X-Check";
  const img = document.createElement("img");
  img.src = chrome.runtime.getURL("shield.png");
  logo.appendChild(img);
  return logo;
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

  panel.innerHTML = shell(
    "Your X-Check profile",
    (note ? `<p class="xcheck-intro" style="color:#1d9bf0">${note}</p>` : "") +
      rows +
      pol +
      `<button class="xcheck-btn secondary" id="xcheck-redo">Redo test</button>`,
  );

  wireClose(panel);
  panel
    .querySelector("#xcheck-redo")
    ?.addEventListener("click", () => renderQuestionnaire(panel));
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
  #xcheck-logo{position:fixed;bottom:20px;right:20px;width:48px;height:48px;border-radius:50%;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.45);z-index:2147483646;transition:transform .15s}
  #xcheck-logo:hover{transform:scale(1.08)}
  #xcheck-logo img{width:100%;height:100%;object-fit:contain;border-radius:50%}
  .xcheck-panel{position:fixed;bottom:84px;right:20px;width:360px;max-height:76vh;overflow-y:auto;background:#15202b;color:#fff;border:1px solid #2f3b47;border-radius:16px;box-shadow:0 10px 36px rgba(0,0,0,.55);z-index:2147483647;font-family:system-ui,-apple-system,Arial,sans-serif;display:none}
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
  `;
  document.head.appendChild(style);
}
