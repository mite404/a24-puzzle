"use client";

import { useCallback, useEffect, useRef } from "react";
import { getActiveOraclePersonaId } from "@/lib/oracle-chat-persona";
import { pickScoreQuip } from "@/lib/oracle-score-quips";
import { scoreQuipTier, type ScoreQuipTier } from "@/lib/scoring";
import type { Scores } from "@/lib/types";
import { useOracleSpeaker } from "@/hooks/use-oracle-speaker";
import { EndScreen } from "@/components/end-screen";
import { TierQuipDebugPanel } from "@/components/tier-quip-debug-panel";

interface EndScreenWithOracleProps {
  scores: Scores;
  onRestart: () => void;
}

export function EndScreenWithOracle({
  scores,
  onRestart,
}: EndScreenWithOracleProps) {
  const personaId = getActiveOraclePersonaId();
  const tier = scoreQuipTier(scores);
  const line = pickScoreQuip(personaId, tier);
  const { speak, cancelSpeech, isSpeaking, audioUnlockedRef } =
    useOracleSpeaker(personaId);
  const spokenRef = useRef(false);

  const speakTierQuip = useCallback(
    async (quipTier: ScoreQuipTier, cacheKey: string) => {
      const text = pickScoreQuip(personaId, quipTier);
      if (!text.trim()) return;
      await speak(text, cacheKey);
    },
    [personaId, speak],
  );

  const fireDebugQuip = useCallback(
    (quipTier: ScoreQuipTier) => {
      cancelSpeech();
      void speakTierQuip(quipTier, `debug:score:${quipTier}:${personaId}`);
    },
    [cancelSpeech, personaId, speakTierQuip],
  );

  useEffect(() => {
    async function speakScoreQuip() {
      if (spokenRef.current || !line.trim()) return;
      if (!audioUnlockedRef.current) return;
      const completed = await speak(line, `score:${tier}:${personaId}`);
      if (completed) spokenRef.current = true;
    }

    void speakScoreQuip();
  }, [audioUnlockedRef, line, personaId, speak, tier]);

  useEffect(() => {
    function unlock() {
      if (spokenRef.current || !line.trim()) return;
      void speak(line, `score:${tier}:${personaId}`).then((completed) => {
        if (completed) spokenRef.current = true;
      });
    }
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, [audioUnlockedRef, line, personaId, speak, tier]);

  return (
    <>
      <EndScreen scores={scores} onRestart={onRestart} />
      <TierQuipDebugPanel
        personaId={personaId}
        activeTier={tier}
        isSpeaking={isSpeaking}
        actions={{
          good: () => fireDebugQuip("good"),
          average: () => fireDebugQuip("average"),
          bad: () => fireDebugQuip("bad"),
        }}
      />
    </>
  );
}
