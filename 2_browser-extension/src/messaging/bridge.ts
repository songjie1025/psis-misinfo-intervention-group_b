// Helpers around chrome.runtime messaging so both sides share one typed contract (§4).
import { isWorkerRequest, WorkerRequest, WorkerResponse } from "./messages";

/** content-script side: send a typed request to the worker and await its typed reply. */
export function sendToWorker(request: WorkerRequest): Promise<WorkerResponse> {
  return chrome.runtime.sendMessage(request);
}

/** service worker side: register a single typed handler for all incoming requests. */
export function onWorkerRequest(
  handler: (
    request: WorkerRequest,
    sender: chrome.runtime.MessageSender,
  ) => Promise<WorkerResponse>,
): void {
  chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    // WORDING_READY is a one-way worker -> content-script notification. Do not feed it back
    // into the request/response handler.
    if (!isWorkerRequest(message)) return false;
    handler(message, sender)
      .then(sendResponse)
      .catch((err: unknown) =>
        sendResponse({ type: "ERROR", message: String(err) }),
      );
    return true; // keep the channel open for the async response
  });
}
