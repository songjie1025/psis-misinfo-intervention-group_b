// Loads quiz_questions.json (packaged with the extension, same pattern as posts.json in
// ../pipeline/mockFactCheck.ts) and hands out a random, ready-to-render quiz. Runs in the service
// worker: chrome.runtime.getURL + fetch works there without any web_accessible_resources entry
// because the file sits at the extension root, same as posts.json.
import { QuizPayload, RawQuizItem } from "./types";
import { buildOptions, pickRandom } from "./logic";

const QUIZ_FILE = "quiz_questions.json";

let quizItems: RawQuizItem[] | null = null;
let allTechniques: string[] = [];

async function loadQuizzes(): Promise<RawQuizItem[]> {
  if (quizItems) return quizItems;
  const url = chrome.runtime.getURL(QUIZ_FILE);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to load ${QUIZ_FILE}: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as RawQuizItem[];
  quizItems = data;
  allTechniques = Array.from(
    new Set(
      data
        .map((q) => q.verdicts?.flicc_technique)
        .filter((t): t is string => typeof t === "string" && t.length > 0),
    ),
  );
  return data;
}

// Avoid showing the exact same quiz twice back-to-back.
let lastQuizId: string | null = null;

/** Pick a random quiz question and build its shuffled multiple-choice options. Returns null only
 *  if quiz_questions.json is empty or every entry is missing the fields a quiz needs. */
export async function getRandomQuiz(): Promise<QuizPayload | null> {
  const items = await loadQuizzes();
  const eligible = items.filter((q) => q.verdicts?.flicc_technique && q.post);
  if (eligible.length === 0) return null;

  let pool = eligible;
  if (eligible.length > 1 && lastQuizId !== null) {
    const withoutLast = eligible.filter((q) => String(q.id) !== lastQuizId);
    if (withoutLast.length > 0) pool = withoutLast;
  }

  const chosen = pickRandom(pool);
  lastQuizId = String(chosen.id);

  const correct = chosen.verdicts!.flicc_technique!; // filtered above
  const options = buildOptions(correct, allTechniques.length ? allTechniques : [correct]);

  return {
    quizId: String(chosen.id),
    post: {
      id: String(chosen.id),
      author: chosen.author ?? "Unknown",
      username: chosen.username ?? "unknown",
      content: chosen.post ?? "",
      timestamp: chosen.timestamp ?? "",
      likes: chosen.likes ?? 0,
      shares: chosen.shares ?? 0,
      category: chosen.category ?? "",
    },
    options,
    correctAnswer: correct,
  };
}
