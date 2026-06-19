export class GeminiClient {
  private static readonly DEFAULT_MODEL = "gemini-2.5-flash";
  private static readonly API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models";

  private readonly apiKey: string;
  private readonly model: string;

  constructor(apiKey: string, model: string = GeminiClient.DEFAULT_MODEL) {
    this.apiKey = apiKey;
    this.model = model;
  }

  async ask(prompt: string): Promise<string> {
    const url = `${GeminiClient.API_URL}/${this.model}:generateContent`;

    const response = await fetch(`${url}?key=${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
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
}
