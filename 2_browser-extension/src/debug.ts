// Lightweight debug logging. Flip DEBUG to false to silence [X-Check] info logs.
export const DEBUG = true;

export function dlog(...args: unknown[]): void {
  if (DEBUG) console.info("[X-Check]", ...args);
}
