// X-Check content script — runs on the mockup page.
// Responsibilities: inject the logo, find posts, ask the worker to check them, hand the
// returned decision to the front-end render seam, and emit behaviour signals (FR4).
import { sendToWorker } from "../messaging/bridge";
import { makeEvent } from "../scoring/behaviour";
import { InterventionDecision } from "../interventions/types";

// Integration contract with the mockup / front-end:
//   each post element carries  data-xcheck-post  and  data-xcheck-post-id="<id>"
const POST_SELECTOR = "[data-xcheck-post]";
const SHORT_DWELL_MS = 1500; // dwell below this on a post counts as "skimmed"
const FAST_SCROLL_PX_PER_S = 2000; // scroll velocity above this counts as "fast scroll"

const contentObserver = new MutationObserver(() => void safeScan());

injectLogo();
startBehaviourTracking();
void safeScan();
observe();

function observe(): void {
  contentObserver.observe(document.body, { childList: true, subtree: true });
}

/** Disconnect the observer around our own DOM writes so injecting a banner can't re-trigger us. */
async function safeScan(): Promise<void> {
  contentObserver.disconnect();
  try {
    await scanPosts();
  } finally {
    observe();
  }
}

async function scanPosts(): Promise<void> {
  const posts = Array.from(
    document.querySelectorAll<HTMLElement>(POST_SELECTOR),
  ).filter((el) => !el.dataset.xcheckChecked);
  // Check posts concurrently so one slow LLM round-trip doesn't block the rest.
  await Promise.all(posts.map((el) => checkPost(el)));
}

async function checkPost(el: HTMLElement): Promise<void> {
  const content = (el.innerText || "").trim();
  if (!content) return;

  if (!el.dataset.xcheckPostId) {
    console.warn(
      "[X-Check] post is missing data-xcheck-post-id; using a text fallback (IDs may collide).",
    );
  }
  const postId = el.dataset.xcheckPostId || content.slice(0, 32);

  let res;
  try {
    res = await sendToWorker({ type: "CHECK_POST", postId, content });
  } catch (err) {
    console.warn("[X-Check] worker call failed:", err);
    return; // leave unmarked so it can be retried on the next scan
  }
  if (!res) return; // MV3 worker was inactive / no response
  if (res.type === "ERROR") {
    console.warn("[X-Check] check failed:", res.message);
    return; // e.g. no API keys yet — retry after the user sets them
  }

  el.dataset.xcheckChecked = "true";
  if (res.type === "DECISION" && res.decision.shouldIntervene) {
    renderDecision(el, res.decision);
  }
}

/**
 * FRONT-END SEAM — the front-end owner builds the real T1/T2/T3 UI here.
 * This placeholder only proves the data flow end-to-end. Replace its body with the designed
 * components, switching on `decision.tier`. Do NOT recompute the tier here (FR5).
 */
function renderDecision(el: HTMLElement, decision: InterventionDecision): void {
  const banner = document.createElement("div");
  banner.className = `xcheck-intervention xcheck-${decision.tier}`;
  Object.assign(banner.style, {
    padding: "8px",
    margin: "4px 0",
    borderLeft: "4px solid #e0245e",
    background: "#fff5f7",
    fontSize: "13px",
  } satisfies Partial<CSSStyleDeclaration>);
  banner.textContent = `[${decision.tier} · ${decision.verdictLabel}] ${decision.headline}`;
  el.prepend(banner);

  banner.addEventListener("click", () => {
    void sendToWorker({
      type: "BEHAVIOUR_EVENT",
      event: makeEvent("READ_EXPANDED_WARNING", decision.postId),
    }).catch(() => {});
  });
}

// ---- FR4 real-time behaviour signals (dwell + scroll velocity) ----
function startBehaviourTracking(): void {
  // Dwell: how long each post stays in view. A very short dwell = "skimmed".
  const enterTimes = new WeakMap<Element, number>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (entry.isIntersecting) {
          enterTimes.set(el, Date.now());
        } else {
          const enteredAt = enterTimes.get(el);
          if (enteredAt === undefined) continue;
          enterTimes.delete(el);
          const dwell = Date.now() - enteredAt;
          if (dwell < SHORT_DWELL_MS) {
            const postId =
              el.dataset.xcheckPostId || (el.innerText || "").trim().slice(0, 32);
            void sendToWorker({
              type: "BEHAVIOUR_EVENT",
              event: makeEvent("SHORT_DWELL_POST", postId, dwell),
            }).catch(() => {});
          }
        }
      }
    },
    { threshold: 0.5 },
  );

  const observePosts = (): void =>
    document
      .querySelectorAll<HTMLElement>(POST_SELECTOR)
      .forEach((el) => io.observe(el));
  observePosts();
  new MutationObserver(observePosts).observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Scroll velocity (throttled): fast scrolling = not reading carefully.
  let lastY = window.scrollY;
  let lastT = Date.now();
  let throttled: number | undefined;
  window.addEventListener(
    "scroll",
    () => {
      if (throttled !== undefined) return;
      throttled = window.setTimeout(() => {
        const now = Date.now();
        const y = window.scrollY;
        const dt = (now - lastT) / 1000;
        const velocity = dt > 0 ? Math.abs(y - lastY) / dt : 0;
        lastY = y;
        lastT = now;
        throttled = undefined;
        if (velocity > FAST_SCROLL_PX_PER_S) {
          void sendToWorker({
            type: "BEHAVIOUR_EVENT",
            event: makeEvent("FAST_SCROLL", undefined, Math.round(velocity)),
          }).catch(() => {});
        }
      }, 200);
    },
    { passive: true },
  );
}

function injectLogo(): void {
  if (document.getElementById("xcheck-floating-logo")) return;
  const logoBadge = document.createElement("div");
  logoBadge.id = "xcheck-floating-logo";
  Object.assign(logoBadge.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    width: "45px",
    height: "45px",
    color: "white",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    zIndex: "9999",
    cursor: "pointer",
    transition: "transform 0.2s ease",
  } satisfies Partial<CSSStyleDeclaration>);
  logoBadge.onmouseenter = () => (logoBadge.style.transform = "scale(1.1)");
  logoBadge.onmouseleave = () => (logoBadge.style.transform = "scale(1.0)");
  const img = document.createElement("img");
  img.src = chrome.runtime.getURL("shield.png");
  Object.assign(img.style, {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    borderRadius: "50%",
  } satisfies Partial<CSSStyleDeclaration>);
  logoBadge.appendChild(img);
  document.body.appendChild(logoBadge);
}
