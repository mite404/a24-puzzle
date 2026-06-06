/**
 * Silences ONE benign, unfixable console error from the ElevenLabs realtime
 * Scribe SDK.
 *
 * After we commit + `disconnect()` on mic release, the ElevenLabs server drops
 * the WebSocket without a close handshake, so the browser reports an "abnormal"
 * 1006 close. The vendored SDK hardcodes a `console.error` for any non-1000
 * close (`node_modules/@elevenlabs/client/dist/scribe/connection.js`), which
 * Next.js then surfaces as a dev "Console Error" overlay on every voice turn.
 *
 * By the time it fires the transcript is already committed and auto-sent, and
 * the emitted error has no usable message (so it never reaches the composer's
 * error strip). It is purely cosmetic dev noise.
 *
 * We filter ONLY that exact message; every other console.error passes through
 * untouched. Runs once, client-side only.
 */
let installed = false;

export function suppressScribeWsCloseNoise(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const original = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const first = args[0];
    if (
      typeof first === "string" &&
      first.startsWith("WebSocket closed unexpectedly: 1006")
    ) {
      return;
    }
    original(...args);
  };
}
