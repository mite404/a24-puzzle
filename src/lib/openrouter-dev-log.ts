import type { OracleUIMessage } from "@/lib/oracle-tools";

const PREFIX = "[openrouter]";

function enabled() {
  return process.env.NODE_ENV === "development";
}

/** Dev-server only — traces chat ↔ OpenRouter in the terminal running `next dev`. */
export function logOpenRouter(
  phase: string,
  detail?: Record<string, unknown>,
) {
  if (!enabled()) return;
  if (detail) {
    console.log(PREFIX, phase, detail);
  } else {
    console.log(PREFIX, phase);
  }
}

export function summarizeIncomingMessages(messages: OracleUIMessage[]) {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  let lastUserPreview: string | undefined;
  if (lastUser) {
    const text = lastUser.parts
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join(" ")
      .trim();
    lastUserPreview = text.slice(0, 80) + (text.length > 80 ? "…" : "");
  }
  return {
    messageCount: messages.length,
    lastUserPreview,
  };
}
