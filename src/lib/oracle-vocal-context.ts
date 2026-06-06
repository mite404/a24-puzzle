import type { OracleUIMessage } from "@/lib/oracle-tools";
import type { VocalEmotionResult } from "@/lib/valence";

export function formatVocalEmotionContext(
  vocalEmotion: VocalEmotionResult,
): string {
  return `[VOCAL_TONE (from mic analysis, confidence ${vocalEmotion.confidence.toFixed(2)}): ${vocalEmotion.emotion}]
Interpret delivery separately from word choice. If tone and words conflict, name the gap in character.`;
}

/**
 * Augment the latest user turn for the model only — UI messages stay clean.
 */
export function injectVocalEmotionForModel(
  messages: OracleUIMessage[],
  vocalEmotion: VocalEmotionResult | null | undefined,
): OracleUIMessage[] {
  if (!vocalEmotion?.emotion) return messages;

  const prefix = `${formatVocalEmotionContext(vocalEmotion)}\n\n`;

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role !== "user") continue;

    const parts = message.parts.map((part) => {
      if (part.type !== "text") return part;
      return { ...part, text: prefix + part.text };
    });

    const next = [...messages];
    next[i] = { ...message, parts };
    return next;
  }

  return messages;
}

export function parseVocalEmotionBody(
  value: unknown,
): VocalEmotionResult | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.emotion !== "string" || !v.emotion.trim()) return null;
  if (typeof v.confidence !== "number") return null;
  if (!v.predictions || typeof v.predictions !== "object") return null;
  return {
    emotion: v.emotion,
    confidence: v.confidence,
    predictions: v.predictions as Record<string, number>,
  };
}
