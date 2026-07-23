import { GeminiClient, GeminiRequestError } from "../../src/pipeline/geminiClient";

function response(status: number, payload: unknown = {}, retryAfter: string | null = null): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => retryAfter },
    json: async () => payload,
  } as unknown as Response;
}

describe("GeminiClient transport", () => {
  const realFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = realFetch;
    jest.useRealTimers();
  });

  it("sends credentials in a header, not a URL query, and does not retry 403", async () => {
    const mockedFetch = jest.fn().mockResolvedValue(response(403));
    globalThis.fetch = mockedFetch as unknown as typeof fetch;

    await expect(new GeminiClient("test-key").ask("fixed prompt")).rejects.toMatchObject({
      name: "GeminiRequestError",
      status: 403,
    } satisfies Partial<GeminiRequestError>);

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockedFetch.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("test-key");
    expect(url).not.toContain("?key=");
    expect(options.headers).toMatchObject({ "x-goog-api-key": "test-key" });
  });

  it("retries a rate limit response once it reaches its next retry slot", async () => {
    jest.useFakeTimers();
    const mockedFetch = jest
      .fn()
      .mockResolvedValueOnce(response(429, {}, "0"))
      .mockResolvedValueOnce(
        response(200, { candidates: [{ content: { parts: [{ text: '{"headline":"H","body":"B"}' }] } }] }),
      );
    globalThis.fetch = mockedFetch as unknown as typeof fetch;

    const pending = new GeminiClient("test-key").ask("fixed prompt");
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(1_500);

    await expect(pending).resolves.toContain('"headline"');
    expect(mockedFetch).toHaveBeenCalledTimes(2);
  });
});
