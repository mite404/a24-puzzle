"use client";

import { getActiveOraclePersonaId } from "@/lib/oracle-chat-persona";
import type { CrosswordLayout } from "@/lib/types";
import { Crossword } from "@/components/games/crossword";
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
  const { speak, isSpeaking, audioUnlockedRef } = useOracleSpeaker(personaId);
  const oracle = useCrosswordOracle({
    personaId,
    words: layout.words,
    speak,
    isSpeaking,
    audioUnlockedRef,
  });

  return (
    <Crossword
      layout={layout}
      onComplete={onComplete}
      onRegenerate={onRegenerate}
      regenerating={regenerating}
      onActiveClueChange={oracle.handleActiveClueChange}
      onWordFilled={oracle.handleWordFilled}
      onReadClue={oracle.readClue}
    />
  );
}
