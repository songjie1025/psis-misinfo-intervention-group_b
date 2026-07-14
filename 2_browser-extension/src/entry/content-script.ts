// X-Check content script — runs on the mockup page. This entry only WIRES the components
// together; scanning, rendering, behaviour tracking, worker comms and the stale-notice all live
// in ./components/. FR1, FR4, FR5.
import { initXCheckPanel } from "../ui/panel";
import { createWorkerClient } from "./components/worker-client";
import { createPostScanner } from "./components/post-scanner";
import { createBehaviourTracker } from "./components/behaviour-tracker";
import { renderDecision } from "./components/intervention-renderer";
import { showStaleNotice } from "./components/stale-notice";

// Worker comms. On the first "extension reloaded" error it shows the stale banner and stops the
// scanner's observer, so we stop talking to the dead worker but the page tells the user to refresh.
const worker = createWorkerClient(() => {
  showStaleNotice();
  scanner.stop();
});

// Behaviour signals -> worker; a tier-zone change re-evaluates visible posts.
const behaviour = createBehaviourTracker({
  send: worker.send,
  onZoneChange: () => void scanner.reevaluateVisible(),
});

// Scanning + rendering; the renderer reports user interaction back through the behaviour tracker.
const scanner = createPostScanner({
  send: worker.send,
  render: (el, decision, onDismiss) =>
    renderDecision(el, decision, behaviour.emit, onDismiss),
});

void initXCheckPanel();
scanner.start();
behaviour.start();
