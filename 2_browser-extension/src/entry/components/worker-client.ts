// Typed wrapper around the worker bridge. Turns the "extension reloaded" lifecycle errors into
// ONE notice (via onFirstStale) and then stops talking to the dead worker.
import { sendToWorker } from "../../messaging/bridge";
import { WorkerRequest, WorkerResponse } from "../../messaging/messages";
import { isContextInvalidated } from "./stale-notice";

export interface WorkerClient {
  send(msg: WorkerRequest): Promise<WorkerResponse | undefined>;
  isStale(): boolean;
}

// chrome.runtime.sendMessage can occasionally hang forever with no resolve/reject at all — most
// often when the MV3 service worker is asleep and wakes up in a state that drops the message
// (e.g. its onMessage listener isn't registered yet), rather than rejecting with one of the
// lifecycle errors stale-notice.ts already knows how to detect. Every caller of `send` (the post
// scanner's rolling-window scan, the quiz injector's fetch, the behaviour tracker's emit) awaits
// its result inside a lock/guard with no timeout of its own — post-scanner.ts's `scanning` flag in
// particular would stay `true` forever, silently freezing ALL future intervention rendering for
// the rest of the page session. This is the leading explanation for interventions intermittently
// and unreproducibly ceasing to appear. Bounding every request here means a stuck call is treated
// like any other failure (logged, resolves to undefined) instead of blocking its caller forever;
// callers already tolerate an undefined/failed response and retry on the next scan/tick.
const REQUEST_TIMEOUT_MS = 6_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("X-Check worker request timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export function createWorkerClient(
  onFirstStale: () => void,
  // Injectable purely so tests can simulate a request that never settles, without depending on
  // chrome.runtime or waiting out the real timeout. Production always uses the real bridge.
  sendImpl: (msg: WorkerRequest) => Promise<WorkerResponse> = sendToWorker,
): WorkerClient {
  let stale = false;

  async function send(msg: WorkerRequest): Promise<WorkerResponse | undefined> {
    if (stale) return undefined;
    try {
      return await withTimeout(sendImpl(msg), REQUEST_TIMEOUT_MS);
    } catch (err) {
      if (isContextInvalidated(err)) {
        stale = true;
        onFirstStale();
        return undefined;
      }
      console.warn("[X-Check] worker call failed:", err);
      return undefined;
    }
  }

  return { send, isStale: () => stale };
}
