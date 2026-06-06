"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OracleUIMessage } from "@/lib/oracle-tools";
import type { OraclePersonaId } from "@/lib/oracle-personas";
import type { OracleChatStatus } from "@/hooks/use-oracle-chat";

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
  openingLine,
}: UseOracleVoiceOptions) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const lastSpokenMessageId = useRef<string | null>(null);
  const lastOpeningPersona = useRef<OraclePersonaId | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const unlockedRef = useRef(false);

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const speak = useCallback(
    async (text: string, cacheKey: string) => {
      if (!text.trim()) return;

      stopPlayback();
      setVoiceError(null);

      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, personaId }),
        });

        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error ?? `Voice failed (${res.status}).`);
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          URL.revokeObjectURL(url);
          if (audioRef.current === audio) audioRef.current = null;
          setIsSpeaking(false);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setIsSpeaking(false);
          setVoiceError("Playback failed.");
        };

        setIsSpeaking(true);
        await audio.play();
        lastSpokenMessageId.current = cacheKey;
      } catch (error) {
        setIsSpeaking(false);
        const message =
          error instanceof Error ? error.message : "Voice synthesis failed.";
        setVoiceError(message);
        if (process.env.NODE_ENV === "development") {
          console.warn("[oracle-voice]", message);
        }
      }
    },
    [personaId, stopPlayback],
  );

  /** First user interaction unlocks autoplay for subsequent TTS. */
  useEffect(() => {
    function unlock() {
      unlockedRef.current = true;
    }
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  /** Opening line when persona / channel changes. */
  useEffect(() => {
    if (!openingLine?.trim()) return;
    if (lastOpeningPersona.current === personaId) return;
    lastOpeningPersona.current = personaId;
    if (!unlockedRef.current) return;
    void speak(openingLine, `opening:${personaId}`);
  }, [openingLine, personaId, speak]);

  /** Assistant reply after stream completes. */
  useEffect(() => {
    if (status !== "ready") return;

    const lastAssistant = [...messages]
      .reverse()
      .find((message) => message.role === "assistant");
    if (!lastAssistant) return;

    const text = extractAssistantText(lastAssistant);
    if (!text || lastSpokenMessageId.current === lastAssistant.id) return;
    if (!unlockedRef.current) return;

    void speak(text, lastAssistant.id);
  }, [messages, status, speak]);

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  return { isSpeaking, voiceError, clearVoiceError: () => setVoiceError(null) };
}
