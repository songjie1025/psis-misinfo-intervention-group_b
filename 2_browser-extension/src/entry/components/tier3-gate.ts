import { POST_SELECTOR } from "./constants";

const STYLE_ID = "xcheck-tier3-gate-styles";
const OVERLAY_ID = "xcheck-tier3-gate";
const ACTION_SELECTOR =
  "[data-xcheck-like], [data-xcheck-share], [data-xcheck-comment]";
const TIER3_SELECTOR = ".xcheck-T3, [data-xcheck-tier='T3']";

export interface Tier3GateOptions {
  waitMs?: number;
}

export interface Tier3Gate {
  stop(): void;
}

export function installTier3Gate({ waitMs = 3000 }: Tier3GateOptions = {}): Tier3Gate {
  ensureStyles();

  const replayTargets = new WeakSet<HTMLElement>();
  let overlay: HTMLElement | null = null;
  let button: HTMLElement | null = null;
  let remainingMs = waitMs;
  let timer: number | null = null;
  let previousBodyOverflow = "";

  function stopTimer(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  function closeOverlay(): void {
    stopTimer();
    overlay?.remove();
    overlay = null;
    button = null;
    document.body.style.overflow = previousBodyOverflow;
  }

  function replayAction(target: HTMLElement | null): void {
    if (!target) return;
    replayTargets.add(target);
    target.click();
  }

  function updateOverlayText(): void {
    if (!overlay) return;
    const text = overlay.querySelector<HTMLElement>("[data-xcheck-tier3-countdown]");
    if (text) {
      text.textContent =
        remainingMs > 0
          ? `Please wait ${Math.ceil(remainingMs / 1000)} seconds.`
          : "You can proceed now.";
    }
    const proceed = overlay.querySelector<HTMLButtonElement>("[data-xcheck-tier3-proceed]");
    if (proceed) {
      proceed.disabled = remainingMs > 0;
      proceed.textContent =
        remainingMs > 0 ? `Please wait (${Math.ceil(remainingMs / 1000)})` : "Continue Action";
    }
  }

  // Show the overlay (popup) and start the countdown timer
  // The user can cancel or wait for the timer to finish before proceeding
  function openOverlay(target: HTMLElement): void {
    closeOverlay();
    button = target;
    remainingMs = waitMs;
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = `
      <div class="xcheck-tier3-card" role="dialog" aria-modal="true" aria-labelledby="xcheck-tier3-title">
        <div class="xcheck-tier3-badge">T3</div>
        <h2 id="xcheck-tier3-title">Are you really sure?</h2>
        <p>This action is currently blocked for this post. Please take a moment to consider whether you really want to proceed.</p>
        <p data-xcheck-tier3-countdown></p>
        <div class="xcheck-tier3-actions">
          <button type="button" class="xcheck-tier3-secondary" data-xcheck-tier3-cancel>Cancel</button>
          <button type="button" class="xcheck-tier3-primary" data-xcheck-tier3-proceed disabled>Please wait (${Math.ceil(remainingMs / 1000)})</button>
        </div>
      </div>
    `;

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeOverlay();
    });
    overlay.querySelector("[data-xcheck-tier3-cancel]")?.addEventListener("click", closeOverlay);
    overlay.querySelector("[data-xcheck-tier3-proceed]")?.addEventListener("click", () => {
      if (remainingMs > 0) return;
      const currentTarget = button;
      closeOverlay();
      replayAction(currentTarget);
    });

    document.body.appendChild(overlay);
    updateOverlayText();

    timer = window.setInterval(() => {
      remainingMs = Math.max(0, remainingMs - 250);
      updateOverlayText();
      if (remainingMs <= 0) stopTimer();
    }, 250);
  }

  // Intercept clicks on like/share/comment buttons for T3 posts and
  // show the overlay instead of proceeding
  function onClick(e: MouseEvent): void {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    if (overlay && target.closest(`#${OVERLAY_ID}`)) return;

    const action = target.closest<HTMLElement>(ACTION_SELECTOR);
    if (!action) return;

    if (replayTargets.has(action)) {
      replayTargets.delete(action);
      return;
    }

    const post = action.closest<HTMLElement>(POST_SELECTOR);
    if (!post) return;
    if (!post.querySelector(TIER3_SELECTOR)) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    openOverlay(action);
  }

  document.addEventListener("click", onClick, true);

  return {
    stop(): void {
      document.removeEventListener("click", onClick, true);
      closeOverlay();
    },
  };
}

// CSS styles for the overlay and card are injected into the page
function ensureStyles(): void {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.62);
      z-index: 2147483647;
      padding: 20px;
    }

    #${OVERLAY_ID} .xcheck-tier3-card {
      width: min(440px, 100%);
      background: #15202b;
      color: #e7e9ea;
      border: 1px solid #1d9bf0;
      border-radius: 18px;
      padding: 20px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
      font-family: system-ui, -apple-system, Arial, sans-serif;
    }

    #${OVERLAY_ID} .xcheck-tier3-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 42px;
      height: 24px;
      padding: 0 10px;
      border-radius: 999px;
      background: #e0245e;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      margin-bottom: 12px;
    }

    #${OVERLAY_ID} h2 {
      margin: 0 0 10px;
      font-size: 20px;
      line-height: 1.2;
    }

    #${OVERLAY_ID} p {
      margin: 0 0 12px;
      color: #cfd9de;
      line-height: 1.5;
      font-size: 14px;
    }

    #${OVERLAY_ID} [data-xcheck-tier3-countdown] {
      color: #1d9bf0;
      font-weight: 600;
      min-height: 1.5em;
    }

    #${OVERLAY_ID} .xcheck-tier3-actions {
      display: flex;
      gap: 10px;
      margin-top: 18px;
    }

    #${OVERLAY_ID} button {
      flex: 1;
      border: 0;
      border-radius: 999px;
      padding: 11px 14px;
      font-weight: 700;
      font-size: 14px;
      cursor: pointer;
    }

    #${OVERLAY_ID} .xcheck-tier3-secondary {
      background: transparent;
      border: 1px solid #38444d;
      color: #e7e9ea;
    }

    #${OVERLAY_ID} .xcheck-tier3-primary {
      background: #1d9bf0;
      color: #fff;
    }

    #${OVERLAY_ID} .xcheck-tier3-primary:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `;

  document.head.appendChild(style);
}
