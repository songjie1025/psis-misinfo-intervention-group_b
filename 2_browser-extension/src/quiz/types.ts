// Types for the misinformation-detection quiz feature (feed intervention that periodically asks
// the user to name the FLICC technique used in a real (mock) post). Source data is
// quiz_questions.json, packaged with the extension — never hardcoded here.

/** Shape of an entry in quiz_questions.json (only the fields we use). */
export interface RawQuizVerdict {
  claim?: { content?: string };
  label?: string;
  flicc_technique?: string;
  sources?: unknown[];
}

export interface RawQuizItem {
  id: number | string;
  verdicts?: RawQuizVerdict;
  post?: string;
  author?: string;
  username?: string;
  category?: string;
  timestamp?: string;
  likes?: number;
  shares?: number;
}

/** The post content shown inside a quiz card. */
export interface QuizPost {
  id: string;
  author: string;
  username: string;
  content: string;
  timestamp: string;
  likes: number;
  shares: number;
  category: string;
}

/** A ready-to-render quiz: the post to show, its 5 shuffled answer options (the correct FLICC
 *  technique + up to 4 random distractors), and the correct answer for grading client-side. */
export interface QuizPayload {
  quizId: string;
  post: QuizPost;
  options: string[];
  correctAnswer: string;
}
