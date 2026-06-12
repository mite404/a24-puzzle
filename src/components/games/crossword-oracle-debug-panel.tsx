"use client";

import { DEBUG_EXPERIENCE_ENABLED } from "@/lib/debug-experience";
import type { OraclePersonaId } from "@/lib/oracle-personas";
import { Button } from "@/components/ui/button";

interface CrosswordOracleDebugActions {
  readClue: () => void;
  idle20: () => void;
  idle45: () => void;
  completed: () => void;
}

interface CrosswordOracleDebugPanelProps {
  personaId: OraclePersonaId;
  isSpeaking: boolean;
  actions: CrosswordOracleDebugActions;
}

/** Dev-only — fire crossword oracle quips without waiting on dwell timers. */
export function CrosswordOracleDebugPanel({
  personaId,
  isSpeaking,
  actions,
}: CrosswordOracleDebugPanelProps) {
  if (!DEBUG_EXPERIENCE_ENABLED) return null;

  return (
    <div
      className="fixed top-14 start-0 z-50 m-3 max-w-[min(100vw-1.5rem,22rem)] border border-foreground bg-background/95 p-3 shadow-sm backdrop-blur-sm"
      aria-label="Debug crossword oracle voice"
    >
      <p className="a24-eyebrow text-muted-foreground">Debug — oracle voice</p>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
        {personaId}
        {isSpeaking ? " · speaking" : ""}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Uses focused clue, else clue #1. Click grid first to unlock audio.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={actions.readClue}
          className="debug-phase-bar__btn h-7 rounded-none px-2 text-[10px] uppercase"
        >
          Read clue
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={actions.idle20}
          className="debug-phase-bar__btn h-7 rounded-none px-2 text-[10px] uppercase"
        >
          Idle 20s
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={actions.idle45}
          className="debug-phase-bar__btn h-7 rounded-none px-2 text-[10px] uppercase"
        >
          Idle 45s LLM
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={actions.completed}
          className="debug-phase-bar__btn h-7 rounded-none px-2 text-[10px] uppercase"
        >
          Filled
        </Button>
      </div>
    </div>
  );
}
