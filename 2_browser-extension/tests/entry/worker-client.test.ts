import { createWorkerClient } from "../../src/entry/components/worker-client";
import { WorkerRequest, WorkerResponse } from "../../src/messaging/messages";

const PING: WorkerRequest = { type: "GET_QUIZ" };

describe("worker client", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves normally when the worker responds promptly", async () => {
    const onFirstStale = jest.fn();
    const sendImpl = jest.fn(async (): Promise<WorkerResponse> => ({ type: "QUIZ", quiz: null }));
    const client = createWorkerClient(onFirstStale, sendImpl);

    await expect(client.send(PING)).resolves.toEqual({ type: "QUIZ", quiz: null });
    expect(onFirstStale).not.toHaveBeenCalled();
    expect(client.isStale()).toBe(false);
  });

  // Regression test: chrome.runtime.sendMessage can occasionally hang forever (no resolve, no
  // reject) when the MV3 service worker wakes up in a bad state, e.g. its onMessage listener isn't
  // registered yet. Every caller of `send` awaits it inside a lock/guard with no timeout of its
  // own (post-scanner.ts's `scanning` flag in particular), so an un-bounded hang here used to
  // freeze intervention rendering for the rest of the page session. `send` must give up after
  // REQUEST_TIMEOUT_MS instead of hanging forever.
  it("gives up instead of hanging forever when the underlying request never settles", async () => {
    const onFirstStale = jest.fn();
    const sendImpl = jest.fn(() => new Promise<WorkerResponse>(() => {})); // never settles
    const client = createWorkerClient(onFirstStale, sendImpl);

    const pending = client.send(PING);
    let settled: WorkerResponse | undefined = { type: "QUIZ", quiz: null }; // sentinel, overwritten
    let hasSettled = false;
    void pending.then((v) => {
      settled = v;
      hasSettled = true;
    });

    // Not yet timed out: the promise must still be pending.
    await Promise.resolve();
    expect(hasSettled).toBe(false);

    jest.advanceTimersByTime(6_000);
    // Let the microtask queue (the timeout rejection -> catch -> resolve(undefined)) flush.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(hasSettled).toBe(true);
    expect(settled).toBeUndefined();
    // A bare timeout is not a lifecycle "stale extension" error, so it must not trigger the
    // one-shot stale-notice banner — the worker might still be reachable on the next call.
    expect(onFirstStale).not.toHaveBeenCalled();
    expect(client.isStale()).toBe(false);
  });

  it("marks the client stale on a lifecycle context-invalidation error", async () => {
    const onFirstStale = jest.fn();
    const sendImpl = jest.fn(async (): Promise<WorkerResponse> => {
      throw new Error("Extension context invalidated.");
    });
    const client = createWorkerClient(onFirstStale, sendImpl);

    await expect(client.send(PING)).resolves.toBeUndefined();
    expect(onFirstStale).toHaveBeenCalledTimes(1);
    expect(client.isStale()).toBe(true);

    // Once stale, no further calls should even reach the underlying sender.
    await client.send(PING);
    expect(sendImpl).toHaveBeenCalledTimes(1);
  });
});
