"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioFormat, CommitStrategy, useScribe } from "@elevenlabs/react";
import { buildScribeKeyterms } from "@/lib/scribe-keyterms";
import {
  resolveVocalEmotion,
  startScribeAudioTap,
  type ScribeAudioTap,
} from "@/lib/scribe-audio-tap";
import type { VocalEmotionResult } from "@/lib/valence";
import { suppressScribeWsCloseNoise } from "@/lib/suppress-scribe-ws-noise";

suppressScribeWsCloseNoise();

interface UseOracleScribeOptions {
  disabled: boolean;
  onPartial: (text: string) => void;
  onCommitted?: (text: string) => void;
  onSubmit: (text: string, vocalEmotion?: VocalEmotionResult) => void;
  onStartListening: () => void;
  keyterms?: string[];
}

function isListeningStatus(status: string): boolean {
  return status === "connected" || status === "transcribing";
}

/**
 * Realtime STT input bus for the oracle composer — tap-to-toggle mic,
 * partials into textarea, auto-send on commit.
 *
 * Mic capture uses manual PCM mode (path b): one getUserMedia stream feeds
 * Scribe via sendAudio and accumulates WAV for Valence on session end.
 */
export function useOracleScribe({
  disabled,
  onPartial,
  onCommitted,
  onSubmit,
  onStartListening,
  keyterms = buildScribeKeyterms(),
}: UseOracleScribeOptions) {
  const onPartialRef = useRef(onPartial);
  const onCommittedRef = useRef(onCommitted);
  const onSubmitRef = useRef(onSubmit);
  const onStartListeningRef = useRef(onStartListening);
  const disconnectRef = useRef<() => void>(() => {});
  const clearTranscriptsRef = useRef<() => void>(() => {});
  const connectAbortRef = useRef<AbortController | null>(null);
  const connectRef = useRef<
    (options?: { token?: string }) => Promise<void>
  >(() => Promise.resolve());
  const sendAudioRef = useRef<(audioBase64: string) => void>(() => {});
  const audioTapRef = useRef<ScribeAudioTap | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const statusRef = useRef<string>("disconnected");
  const commitRef = useRef<() => void>(() => {});
  const hasPartialRef = useRef(false);
  const didCommitRef = useRef(false);

  const discardAudioTap = useCallback(() => {
    const tap = audioTapRef.current;
    audioTapRef.current = null;
    if (tap) void tap.stop();
  }, []);

  const captureVocalEmotion = useCallback(async (): Promise<VocalEmotionResult | null> => {
    const tap = audioTapRef.current;
    audioTapRef.current = null;
    if (!tap) return null;
    const wavBlob = await tap.stop();
    return resolveVocalEmotion(wavBlob);
  }, []);

  const finishSession = useCallback(() => {
    discardAudioTap();
    disconnectRef.current();
    clearTranscriptsRef.current();
  }, [discardAudioTap]);

  const captureVocalEmotionRef = useRef(captureVocalEmotion);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.MANUAL,
    noVerbatim: true,
    languageCode: "eng",
    keyterms,
    autoConnect: false,
    audioFormat: AudioFormat.PCM_16000,
    sampleRate: 16_000,
    onPartialTranscript: ({ text }) => {
      hasPartialRef.current = true;
      onPartialRef.current(text);
    },
    onCommittedTranscript: ({ text }) => {
      onCommittedRef.current?.(text);
      const trimmed = text.trim();

      void (async () => {
        const vocalEmotion = await captureVocalEmotionRef.current();
        if (trimmed) {
          onSubmitRef.current(trimmed, vocalEmotion ?? undefined);
        }
        disconnectRef.current();
        clearTranscriptsRef.current();
      })();
    },
    onDisconnect: () => {
      clearTranscriptsRef.current();
    },
  });

  useEffect(() => {
    onPartialRef.current = onPartial;
    onCommittedRef.current = onCommitted;
    onSubmitRef.current = onSubmit;
    onStartListeningRef.current = onStartListening;
    disconnectRef.current = scribe.disconnect;
    clearTranscriptsRef.current = scribe.clearTranscripts;
    connectRef.current = scribe.connect;
    commitRef.current = scribe.commit;
    sendAudioRef.current = scribe.sendAudio;
    statusRef.current = scribe.status;
    captureVocalEmotionRef.current = captureVocalEmotion;
  }, [
    onPartial,
    onCommitted,
    onSubmit,
    onStartListening,
    scribe.disconnect,
    scribe.clearTranscripts,
    scribe.connect,
    scribe.commit,
    scribe.sendAudio,
    scribe.status,
    captureVocalEmotion,
  ]);

  useEffect(() => {
    if (
      scribe.status === "error" &&
      scribe.error &&
      /uncommitted audio/i.test(scribe.error)
    ) {
      finishSession();
    }
  }, [scribe.status, scribe.error, finishSession]);

  useEffect(() => {
    return () => {
      const tap = audioTapRef.current;
      audioTapRef.current = null;
      if (tap) void tap.stop();
    };
  }, []);

  const startListening = useCallback(async () => {
    if (disabled) return;

    setLocalError(null);
    setErrorDismissed(false);
    hasPartialRef.current = false;
    didCommitRef.current = false;
    onStartListeningRef.current();

    connectAbortRef.current?.abort();
    const abort = new AbortController();
    connectAbortRef.current = abort;

    try {
      const res = await fetch("/api/scribe-token", { signal: abort.signal });

      if (abort.signal.aborted) return;

      if (!res.ok) {
        const payload = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(payload?.error ?? `Scribe token failed (${res.status}).`);
      }

      const data = (await res.json()) as { token?: string };
      if (!data.token?.trim()) {
        throw new Error("Scribe token response missing token.");
      }

      if (abort.signal.aborted) return;

      await connectRef.current({ token: data.token });

      if (abort.signal.aborted) {
        finishSession();
        return;
      }

      const tap = await startScribeAudioTap(
        (base64) => {
          sendAudioRef.current(base64);
        },
        {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      );

      if (abort.signal.aborted) {
        audioTapRef.current = tap;
        finishSession();
        return;
      }

      audioTapRef.current = tap;
    } catch (error) {
      if (abort.signal.aborted) return;
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message =
        error instanceof Error ? error.message : "Scribe connection failed.";
      setLocalError(message);
      if (process.env.NODE_ENV === "development") {
        console.warn("[oracle-scribe]", message);
      }
      finishSession();
    }
  }, [disabled, finishSession]);

  const stopListeningAndSend = useCallback(() => {
    const status = statusRef.current;
    if (status === "connecting") {
      connectAbortRef.current?.abort();
      finishSession();
      return;
    }

    if (!isListeningStatus(status)) return;

    if (didCommitRef.current) {
      finishSession();
      return;
    }

    if (!hasPartialRef.current) {
      finishSession();
      return;
    }

    didCommitRef.current = true;
    try {
      commitRef.current();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Scribe commit failed.";
      if (process.env.NODE_ENV === "development") {
        console.warn("[oracle-scribe]", message);
      }
      finishSession();
    }
  }, [finishSession]);

  const toggleMic = useCallback(() => {
    if (disabled) return;

    const status = statusRef.current;
    if (status === "connecting" || isListeningStatus(status)) {
      stopListeningAndSend();
      return;
    }

    void startListening();
  }, [disabled, startListening, stopListeningAndSend]);

  const clearScribeError = useCallback(() => {
    setLocalError(null);
    setErrorDismissed(true);
  }, []);

  const sdkError =
    scribe.error && /uncommitted audio/i.test(scribe.error)
      ? null
      : scribe.error;
  const scribeError = errorDismissed ? null : localError ?? sdkError;

  return {
    toggleMic,
    isListening: isListeningStatus(scribe.status),
    isConnecting: scribe.status === "connecting",
    scribeError,
    clearScribeError,
  };
}
