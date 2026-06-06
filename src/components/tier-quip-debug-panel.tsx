"use client";

import { DEBUG_EXPERIENCE_ENABLED } from "@/lib/debug-experience";
import type { OraclePersonaId } from "@/lib/oracle-personas";
import type { ScoreQuipTier } from "@/lib/scoring";
import { Button } from "@/components/ui/button";

export interface TierQuipDebugActions {
  good: () => void;
  average: () => void;
  bad: () => void;
}

interface TierQuipDebugPanelProps {
  personaId: OraclePersonaId;
  activeTier: ScoreQuipTier;
  isSpeaking: boolean;
  actions: TierQuipDebugActions;
}

/** Dev-only — preview score-tier oracle lines on the end screen. */
export function TierQuipDebugPanel({
  personaId,
  activeTier,
  isSpeaking,
  actions,
}: TierQuipDebugPanelProps) {
  if (!DEBUG_EXPERIENCE_ENABLED) return null;

  return (
    <div
      className="fixed top-14 start-0 z-50 m-3 max-w-[min(100vw-1.5rem,22rem)] border border-foreground bg-background/95 p-3 shadow-sm backdrop-blur-sm"
      aria-label="Debug tier quip voice"
    >
      <p className="a24-eyebrow text-muted-foreground">Debug — tier quip</p>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
        {personaId} · score band: {activeTier}
        {isSpeaking ? " · speaking" : ""}
      </p>
      <p className="mt-1 text-[10px] text-muted-foreground">
        Click page first if audio is locked.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={actions.good}
          className="debug-phase-bar__btn h-7 rounded-none px-2 text-[10px] uppercase"
        >
          Good
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={actions.average}
          className="debug-phase-bar__btn h-7 rounded-none px-2 text-[10px] uppercase"
        >
          Average
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={actions.bad}
          className="debug-phase-bar__btn h-7 rounded-none px-2 text-[10px] uppercase"
        >
          Bad
        </Button>
      </div>
    </div>
  );
}
