// Typed wrapper around the worker bridge. Turns the "extension reloaded" lifecycle errors into
// ONE notice (via onFirstStale) and then stops talking to the dead worker.
import { sendToWorker } from "../../messaging/bridge";
import { WorkerRequest, WorkerResponse } from "../../messaging/messages";
import { isContextInvalidated } from "./stale-notice";

export interface WorkerClient {
  send(msg: WorkerRequest): Promise<WorkerResponse | undefined>;
  isStale(): boolean;
}

export function createWorkerClient(onFirstStale: () => void): WorkerClient {
  let stale = false;

  async function send(msg: WorkerRequest): Promise<WorkerResponse | undefined> {
    if (stale) return undefined;
    try {
      return await sendToWorker(msg);
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
