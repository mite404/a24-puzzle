"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CommitStrategy, useScribe } from "@elevenlabs/react";
import { buildScribeKeyterms } from "@/lib/scribe-keyterms";
import { suppressScribeWsCloseNoise } from "@/lib/suppress-scribe-ws-noise";

// Filter the benign 1006-close console error the Scribe SDK emits on every
// post-commit disconnect (see the helper's docs). Runs once on client import.
suppressScribeWsCloseNoise();

interface UseOracleScribeOptions {
  disabled: boolean;
  onPartial: (text: string) => void;
  onCommitted?: (text: string) => void;
  onSubmit: (text: string) => void;
  onStartListening: () => void;
  keyterms?: string[];
}

function isListeningStatus(status: string): boolean {
  return status === "connected" || status === "transcribing";
}

/**
 * Realtime STT input bus for the oracle composer — tap-to-toggle mic,
 * partials into textarea, auto-send on commit.
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
  const [localError, setLocalError] = useState<string | null>(null);
  const [errorDismissed, setErrorDismissed] = useState(false);
  const statusRef = useRef<string>("disconnected");
  const commitRef = useRef<() => void>(() => {});
  const hasPartialRef = useRef(false);
  const didCommitRef = useRef(false);

  const finishSession = useCallback(() => {
    disconnectRef.current();
    clearTranscriptsRef.current();
  }, []);

  const scribe = useScribe({
    modelId: "scribe_v2_realtime",
    commitStrategy: CommitStrategy.MANUAL,
    noVerbatim: true,
    languageCode: "eng",
    keyterms,
    autoConnect: false,
    microphone: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    onPartialTranscript: ({ text }) => {
      hasPartialRef.current = true;
      onPartialRef.current(text);
    },
    onCommittedTranscript: ({ text }) => {
      onCommittedRef.current?.(text);
      const trimmed = text.trim();
      if (trimmed) {
        onSubmitRef.current(trimmed);
      }
      finishSession();
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
    statusRef.current = scribe.status;
  }, [
    onPartial,
    onCommitted,
    onSubmit,
    onStartListening,
    scribe.disconnect,
    scribe.clearTranscripts,
    scribe.connect,
    scribe.commit,
    scribe.status,
  ]);

  // The realtime API rejects a commit with < 0.3s of uncommitted audio (e.g.
  // stopping a hair too early). It arrives asynchronously as an error and
  // leaves the socket open, so tear the session down. The message itself is
  // filtered out of `scribeError` below — it's a cancel, not a failure.
  useEffect(() => {
    if (
      scribe.status === "error" &&
      scribe.error &&
      /uncommitted audio/i.test(scribe.error)
    ) {
      finishSession();
    }
  }, [scribe.status, scribe.error, finishSession]);

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

    // Commit at most once per session — a second stop-tap during teardown
    // (statusRef updates a render late) would hit an already-emptied buffer.
    if (didCommitRef.current) {
      finishSession();
      return;
    }

    // Nothing transcribed yet → cancel rather than commit an empty buffer (the
    // API errors on commits with < 0.3s of audio).
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

  // Swallow the benign "< 0.3s uncommitted audio" commit rejection (handled as
  // a cancel above); surface every other SDK error normally.
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
