// Periodically inserts an educational misinformation-detection quiz card into the feed as the
// user scrolls: after every QUIZ_POST_INTERVAL distinct posts encountered, a quiz card is placed
// right after the post that completed the count. Quiz content always comes from
// quiz_questions.json via the service worker (GET_QUIZ) — nothing is hardcoded here.
//
// Same DOM problem as post-scanner.ts: the mockup's React feed re-renders the whole post list on
// state changes (like/share, etc.) and wipes any DOM node it doesn't own, including a card placed
// as a post's nextElementSibling. So this module runs its own MutationObserver + scroll listener
// and reattaches placed quiz cards (preserving their answered state) exactly like post-scanner
// reattaches intervention boxes.
import { WorkerRequest, WorkerResponse } from "../../messaging/messages";
import { QuizPayload } from "../../quiz/types";
import { store } from "../../storage/store";
import { QUIZ_POST_INTERVAL, QUIZ_COOLDOWN_DURATION_MS } from "../../quiz/config";
import { renderQuizCard, QuizCardState } from "./quiz-renderer";
import { POST_SELECTOR, postIdOf } from "./constants";

export interface QuizInjectorDeps {
  send(msg: WorkerRequest): Promise<WorkerResponse | undefined>;
}

export interface QuizInjector {
  start(): void;
  stop(): void;
}

const SCROLL_THROTTLE_MS = 200;
// Identity attribute for placed cards, keyed by the ANCHOR POST id rather than the quiz content
// id (quiz.quizId): quiz_questions.json only has a handful of items and getRandomQuiz() only
// excludes the single most-recently-shown one, so the same quiz content can legitimately be
// picked again for a later, non-consecutive placement. Using quiz.quizId as the DOM/Map key would
// then make that later placement collide with an earlier one still on screen, so removing one
// (e.g. via "Not interested") would wipe both. anchorPostId is guaranteed unique per placement —
// countVisiblePosts() adds every post to `countedPosts` permanently, so a post can trigger a quiz
// at most once ever.
const QUIZ_ANCHOR_ATTR = "data-xcheck-quiz-anchor";

interface PlacedQuiz {
  anchorPostId: string;
  quiz: QuizPayload;
  state: QuizCardState;
}

export function createQuizInjector({ send }: QuizInjectorDeps): QuizInjector {
  // Posts counted so far this page load (ephemeral, like post-scanner's dismissed/seen sets).
  const countedPosts = new Set<string>();
  let postsSincePlacement = 0;
  // Set once the interval is reached; cleared once a quiz is actually placed. Kept around across
  // ticks so a cooldown that's still active when the 20th post arrives is retried on a LATER
  // tick (e.g. the next scroll) rather than requiring 20 more posts.
  let pendingAnchorPostId: string | null = null;
  let pendingFetch = false;

  // Every quiz card currently placed in the feed, keyed by anchorPostId (unique per placement —
  // see QUIZ_ANCHOR_ATTR comment above for why quiz.quizId would be unsafe here), so reattach()
  // can restore each one (including whether the user already answered it) after a React wipe.
  const placed = new Map<string, PlacedQuiz>();

  const observer = new MutationObserver(() => {
    reattach();
    void tick();
  });
  let scrollTimer: number | null = null;

  function findPost(postId: string): HTMLElement | null {
    for (const el of document.querySelectorAll<HTMLElement>(POST_SELECTOR)) {
      if (postIdOf(el) === postId) return el;
    }
    return null;
  }

  function callbacksFor(anchorPostId: string) {
    return {
      // The renderer mutates `state` in place; reattach() will render the card in its answered
      // form on any future wipe, so there's nothing else to do here.
      onAnswer: (_selected: string): void => {
        void _selected;
      },
      onNotInterested: (): void => {
        void anchorPostId; // this callback clears every placed quiz, not just its own card
        // "Not interested" means the user is opting out of quizzes for the whole cooldown
        // window, not just dismissing the one card they clicked — so every quiz card currently
        // sitting in the feed (already placed while scrolling, whether answered or not) should
        // disappear right away too, not linger until the user happens to scroll past it again.
        for (const id of placed.keys()) {
          document
            .querySelectorAll<HTMLElement>(`[${QUIZ_ANCHOR_ATTR}="${id}"]`)
            .forEach((el) => el.remove());
        }
        placed.clear();
        void store.setQuizCooldownUntil(Date.now() + QUIZ_COOLDOWN_DURATION_MS);
      },
    };
  }

  /** Re-insert any placed quiz card that React wiped, preserving its answered state. */
  function reattach(): void {
    for (const [anchorPostId, entry] of placed.entries()) {
      const anchor = findPost(entry.anchorPostId);
      if (!anchor) continue; // anchor post not currently in the DOM — nothing to attach to yet
      const next = anchor.nextElementSibling as HTMLElement | null;
      if (next?.getAttribute(QUIZ_ANCHOR_ATTR) === anchorPostId) continue; // already in place
      const card = renderQuizCard(entry.quiz, entry.state, callbacksFor(anchorPostId));
      card.setAttribute(QUIZ_ANCHOR_ATTR, anchorPostId);
      anchor.after(card);
    }
  }

  /** Count posts the user has actually scrolled to (top edge inside the viewport) once each.
   *  The mock feed renders every post into the DOM upfront, so counting raw DOM presence instead
   *  of visible/reached posts would pace insertion off unrelated DOM churn (e.g. post-scanner
   *  adding/removing intervention boxes) rather than real scroll progress. Posts are in top-to-
   *  bottom document order, so the first not-yet-reached post means everything after it isn't
   *  reached either — safe to stop scanning there. */
  function countVisiblePosts(): void {
    if (pendingAnchorPostId) return; // already have a trigger queued; nothing more to count yet
    for (const el of document.querySelectorAll<HTMLElement>(POST_SELECTOR)) {
      const postId = postIdOf(el);
      if (!postId || countedPosts.has(postId)) continue;
      if (el.getBoundingClientRect().top >= window.innerHeight) break; // not scrolled to yet
      countedPosts.add(postId);
      postsSincePlacement++;
      if (postsSincePlacement >= QUIZ_POST_INTERVAL) {
        pendingAnchorPostId = postId;
        break;
      }
    }
  }

  /** Once QUIZ_POST_INTERVAL is reached (and any cooldown has elapsed), fetch a quiz from the
   *  worker and place it right after the triggering post.
   *
   *  `pendingFetch` is set BEFORE the first `await` below (not just before the network call) so
   *  that overlapping tick() calls — this fires on every DOM mutation, including the one our own
   *  card insertion causes, plus a throttled scroll listener — can never both slip past the guard
   *  and fetch/place a duplicate quiz for the same trigger. */
  async function tick(): Promise<void> {
    if (pendingFetch) return;
    countVisiblePosts();
    if (!pendingAnchorPostId) return;

    pendingFetch = true;
    try {
      const cooldownUntil = await store.getQuizCooldownUntil();
      if (Date.now() < cooldownUntil) return; // still cooling down — retried on a later tick

      const anchorEl = findPost(pendingAnchorPostId);
      if (!anchorEl) return; // triggering post scrolled out of the DOM before we got here

      const res = await send({ type: "GET_QUIZ" });
      if (!res || res.type !== "QUIZ" || !res.quiz) return;

      const quiz = res.quiz;
      const state: QuizCardState = { answered: false, selected: null };
      const anchorPostId = pendingAnchorPostId;
      placed.set(anchorPostId, { anchorPostId, quiz, state });
      postsSincePlacement = 0;
      pendingAnchorPostId = null;

      const card = renderQuizCard(quiz, state, callbacksFor(anchorPostId));
      card.setAttribute(QUIZ_ANCHOR_ATTR, anchorPostId);
      anchorEl.after(card);
    } finally {
      pendingFetch = false;
    }
  }

  function onScroll(): void {
    if (scrollTimer !== null) return;
    scrollTimer = window.setTimeout(() => {
      scrollTimer = null;
      void tick();
    }, SCROLL_THROTTLE_MS);
  }

  function start(): void {
    void tick();
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  function stop(): void {
    observer.disconnect();
    window.removeEventListener("scroll", onScroll);
    if (scrollTimer !== null) {
      clearTimeout(scrollTimer);
      scrollTimer = null;
    }
  }

  return { start, stop };
}
