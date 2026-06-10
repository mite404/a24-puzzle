"use client";

import { useCallback } from "react";
import { getActiveOraclePersonaId } from "@/lib/oracle-chat-persona";
import type { CrosswordLayout } from "@/lib/types";
import { Crossword } from "@/components/games/crossword";
import { CrosswordOracleDebugPanel } from "@/components/games/crossword-oracle-debug-panel";
import { useCrosswordOracle } from "@/hooks/use-crossword-oracle";
import { useOracleSpeaker } from "@/hooks/use-oracle-speaker";

interface CrosswordWithOracleProps {
  layout: CrosswordLayout;
  onComplete: (correct: number) => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
}

export function CrosswordWithOracle({
  layout,
  onComplete,
  onRegenerate,
  regenerating,
}: CrosswordWithOracleProps) {
  const personaId = getActiveOraclePersonaId();
  const { speak, isSpeaking, cancelSpeech, audioUnlockedRef } =
    useOracleSpeaker(personaId);
  const oracle = useCrosswordOracle({
    personaId,
    words: layout.words,
    speak,
    isSpeaking,
    audioUnlockedRef,
  });

  const fireDebug = useCallback(
    (action: () => void) => {
      cancelSpeech();
      action();
    },
    [cancelSpeech],
  );

  const debugActions = {
    readClue: () => fireDebug(oracle.debugReadClue),
    idle20: () => fireDebug(oracle.debugIdle20),
    idle45: () => fireDebug(oracle.debugIdle45),
    completed: () => fireDebug(oracle.debugCompleted),
  };

  return (
    <>
      <Crossword
        layout={layout}
        onComplete={onComplete}
        onRegenerate={onRegenerate}
        regenerating={regenerating}
        onActiveClueChange={oracle.handleActiveClueChange}
        onWordFilled={oracle.handleWordFilled}
        onReadClue={oracle.readClue}
      />
      <CrosswordOracleDebugPanel
        personaId={personaId}
        isSpeaking={isSpeaking}
        actions={debugActions}
      />
    </>
  );
}
