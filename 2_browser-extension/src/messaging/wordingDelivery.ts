import { WordingReadyNotification } from "./messages";

export type WordingNotificationSender = (
  tabId: number,
  notification: WordingReadyNotification,
) => Promise<unknown>;

/**
 * A runtime message sent from a service worker is not a content-script delivery mechanism.
 * Keep the originating tab ID with the asynchronous task and address that tab explicitly.
 */
export async function deliverWordingToContentTab(
  tabId: number | undefined,
  notification: WordingReadyNotification,
  send: WordingNotificationSender,
): Promise<boolean> {
  if (tabId === undefined) return false;
  try {
    await send(tabId, notification);
    return true;
  } catch {
    // The tab may have navigated or reloaded while Gemini was generating. The initial fallback
    // remains correct, so a missed upgrade is safe and must not become an unhandled rejection.
    return false;
  }
}
