/**
 * Silences benign, unfixable Scribe WebSocket teardown noise in dev.
 *
 * After commit + disconnect(), the ElevenLabs server drops the socket without a
 * clean close handshake (1006). The SDK logs via console.log AND console.error;
 * Next.js forward-logs surfaces both as dev overlay noise.
 */
let installed = false;

function isBenignScribe1006Close(args: unknown[]): boolean {
  const text = args
    .map((arg) => (typeof arg === "string" ? arg : ""))
    .join(" ");
  return (
    text.includes("code=1006") ||
    text.includes("WebSocket closed unexpectedly: 1006")
  );
}

export function suppressScribeWsCloseNoise(): void {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const originalError = console.error.bind(console);
  const originalLog = console.log.bind(console);

  console.error = (...args: unknown[]) => {
    if (isBenignScribe1006Close(args)) return;
    originalError(...args);
  };

  console.log = (...args: unknown[]) => {
    if (isBenignScribe1006Close(args)) return;
    originalLog(...args);
  };
}
