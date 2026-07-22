"use client";

import { useCallback, useEffect, useRef } from "react";
import type { OraclePersonaId } from "@/lib/oracle-personas";
import type { PlacedWord } from "@/lib/types";
import { CROSSWORD_ORACLE_QUIPS, formatClueRead, pickQuip } from "@/lib/crossword-oracle-quips";
import {
  applyDwellTierFired,
  createInitialTimingState,
  firstClueWord,
  getDueDwellTier,
  markFirstClueAutoRead,
  markSpoken,
  onActiveClueChange,
  onWordFilled,
  type DwellTier,
} from "@/lib/crossword-oracle-timing";
import { fetchOracleQuipLine, resolveIdle45Line } from "@/lib/crossword-oracle-quip-fetch";
import type { RefObject } from "react";

type SpeakFn = (text: string, cacheKey?: string) => Promise<boolean>;

interface UseCrosswordOracleOptions {
  personaId: OraclePersonaId;
  words: PlacedWord[];
  speak: SpeakFn;
  isSpeaking: boolean;
  audioUnlockedRef: RefObject<boolean>;
}

async function fetchIdle45Quip(
  personaId: OraclePersonaId,
  word: PlacedWord,
  signal?: AbortSignal,
): Promise<string | null> {
  return fetchOracleQuipLine(personaId, word, fetch, signal);
}

export function useCrosswordOracle({
  personaId,
  words,
  speak,
  isSpeaking,
  audioUnlockedRef,
}: UseCrosswordOracleOptions) {
  const timingRef = useRef(createInitialTimingState(0));
  const lastQuipRef = useRef<string | undefined>(undefined);
  const activeWordRef = useRef<PlacedWord | null>(null);
  const firstClueRef = useRef<PlacedWord | null>(null);
  const firstClueReadDoneRef = useRef(false);
  const quipAbortControllerRef = useRef<AbortController | null>(null);

  const quips = CROSSWORD_ORACLE_QUIPS[personaId];

  const speakLine = useCallback(
    async (text: string, cacheKey: string, force = false) => {
      if (!text.trim()) return false;
      if (!force && isSpeaking) return false;
      const completed = await speak(text, cacheKey);
      if (completed) {
        timingRef.current = markSpoken(timingRef.current, Date.now());
        lastQuipRef.current = text;
      }
      return completed;
    },
    [isSpeaking, speak],
  );

  const targetWordForDebug = useCallback((): PlacedWord | null => {
    return activeWordRef.current ?? firstClueRef.current ?? firstClueWord(words);
  }, [words]);

  const buildClueReadLine = useCallback(
    (word: PlacedWord) => {
      const template = pickQuip(quips.clueRead, lastQuipRef.current);
      return formatClueRead(template, word.clue);
    },
    [quips.clueRead],
  );

  const readClue = useCallback(
    async (word?: PlacedWord | null): Promise<boolean> => {
      const target = word ?? activeWordRef.current;
      if (!target) return false;
      const line = buildClueReadLine(target);
      return speakLine(line, `crossword:read:${target.id}`);
    },
    [buildClueReadLine, speakLine],
  );

  const speakIdleTier = useCallback(
    async (tier: DwellTier, word: PlacedWord) => {
      let line: string;
      if (tier === "idle45") {
        quipAbortControllerRef.current?.abort();
        quipAbortControllerRef.current = new AbortController();

        line = resolveIdle45Line(
          await fetchIdle45Quip(personaId, word, quipAbortControllerRef.current.signal),
          quips.idle45,
          lastQuipRef.current,
        );
      } else {
        line = pickQuip(quips.idle20, lastQuipRef.current);
      }

      const completed = await speakLine(line, `crossword:${tier}:${word.id}:${Date.now()}`);
      if (completed) {
        timingRef.current = applyDwellTierFired(timingRef.current, tier);
      }
    },
    [personaId, quips.idle20, quips.idle45, speakLine],
  );

  const handleActiveClueChange = useCallback((word: PlacedWord | null) => {
    activeWordRef.current = word;
    timingRef.current = onActiveClueChange(timingRef.current, word, Date.now());
    quipAbortControllerRef.current?.abort();
  }, []);

  const handleWordFilled = useCallback(
    (word: PlacedWord) => {
      timingRef.current = onWordFilled(timingRef.current, word, Date.now());
      const line = pickQuip(quips.completed, lastQuipRef.current);
      void speakLine(line, `crossword:completed:${word.id}:${Date.now()}`);
    },
    [quips.completed, speakLine],
  );

  const tryFirstClueAutoRead = useCallback(async () => {
    if (firstClueReadDoneRef.current || !firstClueRef.current) return;
    if (!audioUnlockedRef.current) return;

    timingRef.current = markFirstClueAutoRead(timingRef.current);
    const completed = await readClue(firstClueRef.current);
    if (completed) firstClueReadDoneRef.current = true;
  }, [audioUnlockedRef, readClue]);

  useEffect(() => {
    firstClueRef.current = firstClueWord(words);
    void tryFirstClueAutoRead();
  }, [words, tryFirstClueAutoRead]);

  useEffect(() => {
    function unlock() {
      void tryFirstClueAutoRead();
    }
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [tryFirstClueAutoRead]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (isSpeaking) return;
      const word = activeWordRef.current;
      if (!word) return;

      const tier = getDueDwellTier({
        state: timingRef.current,
        nowMs: Date.now(),
        isSpeaking,
      });
      if (!tier) return;

      void speakIdleTier(tier, word);
    }, 1000);

    return () => window.clearInterval(interval);
  }, [isSpeaking, speakIdleTier]);

  const debugReadClue = useCallback(() => {
    const word = targetWordForDebug();
    if (!word) return;
    void readClue(word);
  }, [readClue, targetWordForDebug]);

  const debugIdle20 = useCallback(() => {
    const word = targetWordForDebug();
    if (!word) return;
    const line = pickQuip(quips.idle20, lastQuipRef.current);
    void speakLine(line, `debug:idle20:${word.id}`, true);
  }, [quips.idle20, speakLine, targetWordForDebug]);

  const debugIdle45 = useCallback(() => {
    const word = targetWordForDebug();
    if (!word) return;
    void (async () => {
      const line = resolveIdle45Line(
        await fetchIdle45Quip(personaId, word),
        quips.idle45,
        lastQuipRef.current,
      );
      await speakLine(line, `debug:idle45:${word.id}`, true);
    })();
  }, [personaId, quips.idle45, speakLine, targetWordForDebug]);

  const debugCompleted = useCallback(() => {
    const word = targetWordForDebug();
    if (!word) return;
    const line = pickQuip(quips.completed, lastQuipRef.current);
    void speakLine(line, `debug:completed:${word.id}`, true);
  }, [quips.completed, speakLine, targetWordForDebug]);

  return {
    handleActiveClueChange,
    handleWordFilled,
    readClue,
    debugReadClue,
    debugIdle20,
    debugIdle45,
    debugCompleted,
  };
}
