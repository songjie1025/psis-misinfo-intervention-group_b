import { WordingReadyNotification } from "../../src/messaging/messages";
import { deliverWordingToContentTab } from "../../src/messaging/wordingDelivery";

const notification: WordingReadyNotification = {
  type: "WORDING_READY",
  postId: "post-42",
  tier: "T3",
  headline: "A brief pause may help.",
  body: "Validated generated wording.",
};

describe("asynchronous wording delivery", () => {
  it("targets the tab that initiated the post check", async () => {
    const send = jest.fn(async () => undefined);

    await expect(deliverWordingToContentTab(17, notification, send)).resolves.toBe(true);
    expect(send).toHaveBeenCalledWith(17, notification);
  });

  it("does not attempt a broadcast without an originating tab", async () => {
    const send = jest.fn(async () => undefined);

    await expect(deliverWordingToContentTab(undefined, notification, send)).resolves.toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("keeps the fallback in place when the original tab has reloaded", async () => {
    const send = jest.fn(async () => {
      throw new Error("Could not establish connection. Receiving end does not exist.");
    });

    await expect(deliverWordingToContentTab(17, notification, send)).resolves.toBe(false);
  });
});
