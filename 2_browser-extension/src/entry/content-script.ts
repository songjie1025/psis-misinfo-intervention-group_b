// X-Check content script — runs on the mockup page. This entry only WIRES the components
// together; scanning, rendering, behaviour tracking, worker comms and the stale-notice all live
// in ./components/. FR1, FR4, FR5.
import { initXCheckPanel } from "../ui/panel";
import { createWorkerClient } from "./components/worker-client";
import { createPostScanner } from "./components/post-scanner";
import { createBehaviourTracker } from "./components/behaviour-tracker";
import { renderDecision } from "./components/intervention-renderer";
import { showStaleNotice } from "./components/stale-notice";
import { createQuizInjector } from "./components/quiz-injector";
import { isWordingReadyNotification } from "../messaging/messages";

// Worker comms. On the first "extension reloaded" error it shows the stale banner and stops the
// scanner's observer, so we stop talking to the dead worker but the page tells the user to refresh.
const worker = createWorkerClient(() => {
  showStaleNotice();
  scanner.stop();
});

// Behaviour signals -> worker; a tier-zone change re-evaluates visible posts.
const behaviour = createBehaviourTracker({
  send: worker.send,
  isFlaggedPost: (postId) => scanner.isFlaggedPost(postId),
  onZoneChange: () => void scanner.reevaluateVisible(),
});

// Scanning + rendering; the renderer reports user interaction back through the behaviour tracker.
const scanner = createPostScanner({
  send: worker.send,
  render: (el, decision, onDismiss) =>
    renderDecision(el, decision, behaviour.emit, onDismiss),
});

// CHECK_POST always returns promptly with pre-written mock copy. A later, validated Gemini
// result is pushed as a one-way notification and replaces only the matching live decision.
chrome.runtime.onMessage.addListener((message: unknown) => {
  if (!isWordingReadyNotification(message)) return;
  scanner.applyWordingUpdate(message.postId, message.tier, message.headline, message.body);
  // This runs in the mockup page's DevTools, distinct from the Service Worker log. It confirms
  // that a validated Gemini response crossed the worker-to-page boundary.
  console.info(`[X-Check][wording] Gemini wording received for post ${message.postId}.`);
});

// Periodic misinformation-detection quiz cards; a correct answer is a reflective action and
// therefore sends the small QUIZ_CORRECT Risk Score event.
const quiz = createQuizInjector({
  send: worker.send,
  onCorrectAnswer: () => void scanner.reevaluateVisible(),
});

void initXCheckPanel();
scanner.start();
behaviour.start();
quiz.start();
