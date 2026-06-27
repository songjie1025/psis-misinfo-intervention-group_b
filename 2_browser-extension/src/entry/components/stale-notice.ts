// Detecting + signalling the "extension reloaded, page not refreshed" out-of-sync state.

/** True if the error means this old content-script lost its connection to a reloaded extension. */
export function isContextInvalidated(err: unknown): boolean {
  const m = String(err);
  return (
    m.includes("context invalidated") ||
    m.includes("message port closed") ||
    m.includes("message channel closed") ||
    m.includes("Receiving end does not exist")
  );
}

// Show ONE clear notice (console + an in-page banner) instead of spamming the error log, so the
// user still KNOWS the page is out of sync — with a clearer, visible signal.
export function showStaleNotice(): void {
  console.warn("[X-Check] extension was reloaded — refresh this page (Cmd/Ctrl+R) to reconnect.");
  if (document.getElementById("xcheck-stale")) return;
  const banner = document.createElement("div");
  banner.id = "xcheck-stale";
  banner.textContent = "X-Check was updated — refresh this page (\u2318R) to reconnect.";
  Object.assign(banner.style, {
    position: "fixed",
    bottom: "84px",
    left: "50%",
    transform: "translateX(-50%)",
    background: "#15202b",
    color: "#fff",
    border: "1px solid #1d9bf0",
    padding: "8px 14px",
    borderRadius: "999px",
    fontSize: "13px",
    zIndex: "2147483647",
    boxShadow: "0 4px 14px rgba(0,0,0,.4)",
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(banner);
}
