"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { areVoiceApisEnabled } from "@/lib/debug-voice";
import type { OraclePersonaId } from "@/lib/oracle-personas";
import { resolveOracleVoiceSettings } from "@/lib/oracle-voice-settings";
import type { VocalEmotionResult } from "@/lib/valence";

/**
 * Shared TTS playback: fetch /api/voice, play through the TV speaker, generation
 * guard prevents overlapping clips. Returns whether playback completed without
 * being superseded so callers can dedupe (e.g. chat lastSpokenMessageId).
 */
export function useOracleSpeaker(personaId: OraclePersonaId) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const speakGenerationRef = useRef(0);
  const unlockedRef = useRef(false);

  const stopPlayback = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  /** Stop playback and discard any in-flight /api/voice synth fetch when it resolves. */
  const cancelSpeech = useCallback(() => {
    speakGenerationRef.current += 1;
    stopPlayback();
  }, [stopPlayback]);

  const speak = useCallback(
    async (
      text: string,
      _cacheKey?: string,
      vocalEmotion?: VocalEmotionResult | null,
    ): Promise<boolean> => {
      if (!text.trim()) return false;
      if (!areVoiceApisEnabled()) return false;

      const generation = ++speakGenerationRef.current;
      stopPlayback();
      setVoiceError(null);

      const voiceSettings = resolveOracleVoiceSettings(personaId, vocalEmotion);

      try {
        const res = await fetch("/api/voice", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, personaId, voiceSettings }),
        });

        if (generation !== speakGenerationRef.current) return false;

        if (!res.ok) {
          const payload = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error ?? `Voice failed (${res.status}).`);
        }

        const blob = await res.blob();
        if (generation !== speakGenerationRef.current) return false;

        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;

        audio.onended = () => {
          if (audioRef.current !== audio) return;
          URL.revokeObjectURL(url);
          audioRef.current = null;
          setIsSpeaking(false);
        };
        audio.onerror = () => {
          if (audioRef.current !== audio) return;
          URL.revokeObjectURL(url);
          audioRef.current = null;
          setIsSpeaking(false);
          setVoiceError("Playback failed.");
        };

        setIsSpeaking(true);
        await audio.play();
        if (generation !== speakGenerationRef.current) {
          audio.onended = null;
          audio.onerror = null;
          audio.pause();
          URL.revokeObjectURL(url);
          if (audioRef.current === audio) audioRef.current = null;
          setIsSpeaking(false);
          return false;
        }
        return true;
      } catch (error) {
        if (generation !== speakGenerationRef.current) return false;
        setIsSpeaking(false);
        const message =
          error instanceof Error ? error.message : "Voice synthesis failed.";
        if (/interrupted|abort/i.test(message)) return false;
        setVoiceError(message);
        if (process.env.NODE_ENV === "development") {
          console.warn("[oracle-speaker]", message);
        }
        return false;
      }
    },
    [personaId, stopPlayback],
  );

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

  useEffect(() => () => stopPlayback(), [stopPlayback]);

  return {
    isSpeaking,
    voiceError,
    clearVoiceError: () => setVoiceError(null),
    cancelSpeech,
    speak,
    audioUnlockedRef: unlockedRef,
  };
}
