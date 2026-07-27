export const DEFAULT_GEMINI_MODEL = "gemini-3.1-flash-lite";

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 12_000;

export class GeminiRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "GeminiRequestError";
  }
}

function retryAfterMs(header: string | null): number | undefined {
  if (!header) return undefined;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function retryDelayMs(attempt: number, response?: Response): number {
  const hinted = response ? retryAfterMs(response.headers.get("retry-after")) : undefined;
  const backoff = 1000 * 2 ** attempt;
  // Small jitter prevents several queued/reloaded clients from retrying in lockstep.
  return Math.max(hinted ?? 0, backoff) + Math.floor(Math.random() * 250);
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export class GeminiClient {
  private static readonly API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models";

  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string = DEFAULT_GEMINI_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async ask(prompt: string): Promise<string> {
    const url = `${GeminiClient.API_URL}/${this.model}:generateContent`;
    const body = JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 256,
        responseMimeType: "application/json",
      },
    });

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      let response: Response;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
        try {
          response = await fetch(url, {
            method: "POST",
            // Keeping the key out of the URL reduces accidental exposure through URL diagnostics.
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": this.apiKey,
            },
            body,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }
      } catch {
        if (attempt < MAX_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt)));
          continue;
        }
        throw new GeminiRequestError("Gemini request failed");
      }

      if (!response.ok) {
        const retryable = isRetryableStatus(response.status);
        if (retryable && attempt < MAX_ATTEMPTS - 1) {
          await new Promise((resolve) => setTimeout(resolve, retryDelayMs(attempt, response)));
          continue;
        }
        throw new GeminiRequestError(
          `Gemini HTTP ${response.status}`,
          response.status,
          retryAfterMs(response.headers.get("retry-after")),
        );
      }

      const data = await response.json();

      try {
        return data.candidates[0].content.parts[0].text as string;
      } catch {
        const finishReason: string =
          data.candidates?.[0]?.finishReason ?? "UNKNOWN";
        return `[Gemini blocked: ${finishReason}]`;
      }
    }

    throw new GeminiRequestError("Gemini request failed");
  }
}
