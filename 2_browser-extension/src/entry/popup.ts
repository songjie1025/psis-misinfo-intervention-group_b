// X-Check popup — BYOK API-key entry + "clear my data". The personality questionnaire now
// lives in the page (the floating X-Check shield, bottom-right), not here.
import { store } from "../storage/store";

console.info("[X-Check] popup loaded");

async function render(): Promise<void> {
  const keys = await store.getApiKeys();

  const container = document.createElement("div");
  container.style.marginTop = "10px";
  container.innerHTML = `
    <input id="xc-gemini" type="password" placeholder="Gemini API key"
           style="width:100%;margin:4px 0;box-sizing:border-box;" />
    <input id="xc-fc" type="password" placeholder="Fact Check API key"
           style="width:100%;margin:4px 0;box-sizing:border-box;" />
    <button id="xc-save" style="width:100%;margin:4px 0;">Save keys</button>
    <button id="xc-clear" style="width:100%;margin:4px 0;">Clear my data</button>
    <p style="font-size:11px;color:#8899a6;margin:6px 0 0;">
      The personality questionnaire is on the page — click the X-Check shield (bottom-right).
    </p>
    <p id="xc-status" style="font-size:11px;margin:4px 0;"></p>
  `;
  document.body.appendChild(container);

  const geminiInput = document.getElementById("xc-gemini") as HTMLInputElement;
  const fcInput = document.getElementById("xc-fc") as HTMLInputElement;
  const status = document.getElementById("xc-status") as HTMLElement;
  geminiInput.value = keys?.gemini ?? "";
  fcInput.value = keys?.factCheck ?? "";

  (document.getElementById("xc-save") as HTMLButtonElement).addEventListener(
    "click",
    async () => {
      await store.setApiKeys({
        gemini: geminiInput.value.trim(),
        factCheck: fcInput.value.trim(),
      });
      status.textContent = "Keys saved locally.";
    },
  );

  (document.getElementById("xc-clear") as HTMLButtonElement).addEventListener(
    "click",
    async () => {
      await store.clearAll();
      geminiInput.value = "";
      fcInput.value = "";
      status.textContent = "All X-Check data cleared. Reload the page to re-run onboarding.";
    },
  );
}

void render();
