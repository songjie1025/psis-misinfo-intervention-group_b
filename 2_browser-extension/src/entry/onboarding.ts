// X-Check onboarding questionnaire (FR1) — renders the item bank, scores it locally,
// and stores the resulting profile + initial Risk Score. Nothing is uploaded (§6).
import { ALL_ITEMS, POLITICAL_QUESTION } from "../profile/items";
import { hasAllMandatoryAnswers, scoreAnswers } from "../profile/scoring";
import { buildProfile } from "../profile/profile";
import { baselineFromProfile } from "../scoring/riskScore";
import { initialState } from "../scoring/learning";
import { store } from "../storage/store";
import {
  AnswerValue,
  PoliticalOrientation,
  QuestionnaireAnswers,
} from "../profile/types";

const SCALE = [1, 2, 3, 4, 5] as const;

function render(): void {
  const root = document.getElementById("xc-root");
  if (!root) return;

  const itemsHtml = ALL_ITEMS.map((item) => {
    const radios = SCALE.map(
      (n) =>
        `<label style="margin:0 8px;"><input type="radio" name="${item.id}" value="${n}" /> ${n}</label>`,
    ).join("");
    const tag = item.optional ? " <em>(optional)</em>" : "";
    return `<div style="margin:14px 0;"><p style="margin:0 0 4px;">${item.text}${tag}</p>${radios}</div>`;
  }).join("");

  const politicalHtml = `<div style="margin:14px 0;">
    <p style="margin:0 0 4px;">${POLITICAL_QUESTION.text}</p>
    <select id="xc-political">
      <option value="">— skip —</option>
      ${POLITICAL_QUESTION.options
        .map((o) => `<option value="${o}">${o}</option>`)
        .join("")}
    </select></div>`;

  root.innerHTML = `
    <h2>X-Check — quick questionnaire</h2>
    <p>1 = strongly disagree, 5 = strongly agree. The Big Five questions are required;
       the rest are optional. Your answers stay on this device.</p>
    ${itemsHtml}
    ${politicalHtml}
    <button id="xc-submit">Save profile</button>
    <p id="xc-msg" style="margin-top:10px;"></p>
  `;

  document
    .getElementById("xc-submit")
    ?.addEventListener("click", () => void submit());
}

function collectAnswers(): QuestionnaireAnswers {
  const answers: QuestionnaireAnswers = {};
  for (const item of ALL_ITEMS) {
    const checked = document.querySelector<HTMLInputElement>(
      `input[name="${item.id}"]:checked`,
    );
    if (checked) answers[item.id] = Number(checked.value) as AnswerValue;
  }
  return answers;
}

async function submit(): Promise<void> {
  const msg = document.getElementById("xc-msg");
  const answers = collectAnswers();

  if (!hasAllMandatoryAnswers(answers)) {
    if (msg) {
      msg.style.color = "#c00";
      msg.textContent = "Please answer all required (Big Five) questions.";
    }
    return;
  }

  const profile = buildProfile(scoreAnswers(answers));
  await store.setProfile(profile);
  await store.setRiskState(initialState(baselineFromProfile(profile)));

  const political = (
    document.getElementById("xc-political") as HTMLSelectElement | null
  )?.value;
  if (political) await store.setPolitical(political as PoliticalOrientation);

  await store.setOnboardingComplete(true);

  if (msg) {
    msg.style.color = "#080";
    msg.textContent = "Profile saved locally. You can close this tab.";
  }
}

render();
