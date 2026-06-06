"use client";

import { useCallback, useEffect, useRef } from "react";
import type { OracleUIMessage } from "@/lib/oracle-tools";
import type { OraclePersonaId } from "@/lib/oracle-personas";
import type { VocalEmotionResult } from "@/lib/valence";
import type { OracleChatStatus } from "@/hooks/use-oracle-chat";
import { useOracleSpeaker } from "@/hooks/use-oracle-speaker";

function extractAssistantText(message: OracleUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

interface UseOracleVoiceOptions {
  personaId: OraclePersonaId;
  messages: OracleUIMessage[];
  status: OracleChatStatus;
  /** Last detected user vocal tone from the mic turn that prompted the reply. */
  vocalEmotion?: VocalEmotionResult | null;
  /** Spoken once when the scene mounts or the dial changes channel. */
  openingLine?: string;
}

/**
 * Presentation layer: after each assistant turn finishes streaming, synthesize
 * speech via /api/voice and play through the TV "speaker."
 */
export function useOracleVoice({
  personaId,
  messages,
  status,
  vocalEmotion = null,
  openingLine,
}: UseOracleVoiceOptions) {
  const lastSpokenMessageId = useRef<string | null>(null);
  const lastOpeningPersona = useRef<OraclePersonaId | null>(null);

  const {
    isSpeaking,
    voiceError,
    clearVoiceError,
    cancelSpeech,
    speak: speakRaw,
    audioUnlockedRef,
  } = useOracleSpeaker(personaId);

  const speak = useCallback(
    async (
      text: string,
      cacheKey: string,
      emotionForTurn?: VocalEmotionResult | null,
    ) => {
      const completed = await speakRaw(text, cacheKey, emotionForTurn);
      if (completed) {
        lastSpokenMessageId.current = cacheKey;
      }
    },
    [speakRaw],
  );

  /**
   * Mark every current assistant message id as already-spoken so the reactive
   * speak effect never voices a reply the user talked over.
   */
  const consumePendingReplies = useCallback(() => {
    const lastAssistantMessage = messages
      .filter((message) => message.role === "assistant")
      .at(-1);

    if (lastAssistantMessage) {
      lastSpokenMessageId.current = lastAssistantMessage.id;
    }
  }, [messages]);

  /** Opening line when persona / channel changes. */
  useEffect(() => {
    if (!openingLine?.trim()) return;
    if (lastOpeningPersona.current === personaId) return;
    lastOpeningPersona.current = personaId;
    if (!audioUnlockedRef.current) return;
    void speak(openingLine, `opening:${personaId}`);
  }, [openingLine, personaId, speak, audioUnlockedRef]);

  /** Assistant reply after stream completes. */
  useEffect(() => {
    if (status !== "ready") return;

    const lastAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");
    if (!lastAssistant) return;

    const text = extractAssistantText(lastAssistant);
    if (!text || lastSpokenMessageId.current === lastAssistant.id) return;
    if (!audioUnlockedRef.current) return;

    void speak(text, lastAssistant.id, vocalEmotion);
  }, [messages, status, speak, vocalEmotion, audioUnlockedRef]);

  return {
    isSpeaking,
    voiceError,
    clearVoiceError,
    cancelSpeech,
    consumePendingReplies,
  };
}
