// ---- FRONT-END SEAM ----
// Renders one misinformation-detection quiz card. Deliberately styled to look NEITHER like a
// normal feed post NOR like an X-Check verdict intervention (intervention-renderer.ts uses
// red/orange "this is false" colouring): a purple accent + a "X-CHECK QUIZ" header make it read
// immediately as an educational insert. quiz-injector.ts owns placement/reattachment; this file
// only builds the DOM and wires the two interactions (answer, "Not interested").
import { QuizPayload } from "../../quiz/types";

/** Mutable per-quiz state, owned by quiz-injector.ts so a React-driven DOM wipe can be repaired by
 *  re-calling renderQuizCard with the same state object (see quiz-injector.ts's reattach()). */
export interface QuizCardState {
  answered: boolean;
  selected: string | null;
}

export interface QuizCardCallbacks {
  onAnswer(selected: string): void;
  onNotInterested(): void;
}

const ACCENT = "#a855f7"; // purple — distinct from verdict red/orange and the panel's blue
const CORRECT_COLOR = "#00ba7c";
const INCORRECT_COLOR = "#e0245e";

export function renderQuizCard(
  quiz: QuizPayload,
  state: QuizCardState,
  callbacks: QuizCardCallbacks,
): HTMLElement {
  const card = document.createElement("div");
  card.className = "xcheck-quiz-card";
  // Content marker only (which quiz_questions.json item this is) — NOT a placement identity.
  // The same quiz item can legitimately be placed more than once in a session, so
  // quiz-injector.ts tracks/removes cards by anchor post id, not by this attribute.
  card.dataset.xcheckQuiz = quiz.quizId;
  Object.assign(card.style, {
    margin: "8px 0",
    padding: "14px 16px",
    borderRadius: "16px",
    border: `1.5px solid ${ACCENT}`,
    background: "linear-gradient(180deg, rgba(168,85,247,0.16), rgba(168,85,247,0.04))",
    color: "#e7e9ea",
    fontSize: "13px",
    lineHeight: "1.5",
  } satisfies Partial<CSSStyleDeclaration>);

  card.innerHTML =
    `<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">` +
    `<span aria-hidden="true" style="font-size:16px">\u{1F9E0}</span>` +
    `<span style="font-weight:800;color:${ACCENT};letter-spacing:.03em;font-size:11px">X-CHECK QUIZ</span>` +
    `<span style="margin-left:auto;font-size:11px;color:#8899a6">Misinformation check-in</span></div>` +
    `<div style="font-weight:700;margin-bottom:10px">Guess why this post indicates untruthfulness</div>` +
    `<div class="xcheck-quiz-post" style="border:1px solid #38444d;border-radius:12px;padding:10px 12px;` +
    `margin-bottom:12px;background:rgba(0,0,0,0.25)">` +
    `<div style="display:flex;gap:6px;align-items:baseline;font-size:12px;color:#8899a6;margin-bottom:4px">` +
    `<span style="font-weight:600;color:#e7e9ea">${escapeHtml(quiz.post.author)}</span>` +
    `<span>@${escapeHtml(quiz.post.username)}</span>` +
    (quiz.post.timestamp ? `<span>\u00b7 ${escapeHtml(quiz.post.timestamp)}</span>` : "") +
    `</div><div>${escapeHtml(quiz.post.content)}</div></div>` +
    `<div class="xcheck-quiz-question" style="font-size:12px;color:#8899a6;margin-bottom:8px">` +
    `Which misinformation technique is being used?</div>` +
    `<div class="xcheck-quiz-options" style="display:flex;flex-direction:column;gap:6px;margin-bottom:10px"></div>` +
    `<div class="xcheck-quiz-feedback" style="font-size:12px;font-weight:700;margin-bottom:8px;display:none"></div>` +
    `<button type="button" class="xcheck-quiz-skip">Not interested</button>`;

  Object.assign(
    (card.querySelector<HTMLButtonElement>(".xcheck-quiz-skip") as HTMLButtonElement).style,
    {
      background: "transparent",
      border: "1px solid #38444d",
      color: "#8899a6",
      borderRadius: "999px",
      padding: "6px 12px",
      fontSize: "12px",
      cursor: "pointer",
    } satisfies Partial<CSSStyleDeclaration>,
  );

  const optionsWrap = card.querySelector<HTMLElement>(".xcheck-quiz-options")!;
  quiz.options.forEach((option) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "xcheck-quiz-option";
    btn.textContent = option;
    btn.dataset.option = option;
    styleOption(btn, "default");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (state.answered) return;
      state.answered = true;
      state.selected = option;
      applyAnswerState(card, quiz, state);
      callbacks.onAnswer(option);
    });
    optionsWrap.appendChild(btn);
  });

  card.querySelector(".xcheck-quiz-skip")?.addEventListener("click", (e) => {
    e.stopPropagation();
    callbacks.onNotInterested();
  });

  // Same reasoning as the intervention box: the card lives inside/next to a post <article> whose
  // click handler opens the post detail view. Stop the event so answering never navigates away.
  card.addEventListener("click", (e) => e.stopPropagation());

  if (state.answered) applyAnswerState(card, quiz, state);

  return card;
}

function applyAnswerState(card: HTMLElement, quiz: QuizPayload, state: QuizCardState): void {
  const buttons = card.querySelectorAll<HTMLButtonElement>(".xcheck-quiz-option");
  const feedback = card.querySelector<HTMLElement>(".xcheck-quiz-feedback");
  const isCorrect = state.selected === quiz.correctAnswer;

  buttons.forEach((btn) => {
    btn.disabled = true;
    const opt = btn.dataset.option ?? "";
    if (opt === quiz.correctAnswer) {
      styleOption(btn, "correct");
    } else if (opt === state.selected) {
      styleOption(btn, "incorrect");
    } else {
      styleOption(btn, "muted");
    }
  });

  if (feedback) {
    feedback.style.display = "block";
    feedback.style.color = isCorrect ? CORRECT_COLOR : INCORRECT_COLOR;
    feedback.textContent = isCorrect
      ? "Correct! That's the misinformation technique used here."
      : `Not quite \u2014 the technique used here was "${quiz.correctAnswer}".`;
  }

  card.querySelector(".xcheck-quiz-skip")?.remove();
}

type OptionStyle = "default" | "correct" | "incorrect" | "muted";

const OPTION_STYLES: Record<OptionStyle, Partial<CSSStyleDeclaration>> = {
  default: {
    background: "rgba(255,255,255,0.05)",
    border: "1px solid #38444d",
    color: "#e7e9ea",
    fontWeight: "500",
  },
  correct: {
    background: "rgba(0,186,124,0.18)",
    border: `1px solid ${CORRECT_COLOR}`,
    color: CORRECT_COLOR,
    fontWeight: "700",
  },
  incorrect: {
    background: "rgba(224,36,94,0.18)",
    border: `1px solid ${INCORRECT_COLOR}`,
    color: INCORRECT_COLOR,
    fontWeight: "700",
  },
  muted: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid #2f3b47",
    color: "#8899a6",
    fontWeight: "500",
  },
};

function styleOption(btn: HTMLButtonElement, kind: OptionStyle): void {
  Object.assign(btn.style, {
    textAlign: "left",
    padding: "8px 12px",
    borderRadius: "10px",
    fontSize: "13px",
    cursor: kind === "default" ? "pointer" : "default",
  } satisfies Partial<CSSStyleDeclaration>);
  Object.assign(btn.style, OPTION_STYLES[kind]);
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
// ---- END FRONT-END SEAM ----
