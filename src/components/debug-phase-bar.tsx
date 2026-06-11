"use client";

import type { DebugJumpTarget } from "@/lib/debug-experience";
import { useDebugVoice } from "@/hooks/use-debug-voice";
import type { Phase } from "@/lib/types";
import { Button } from "@/components/ui/button";

const JUMPS: { target: DebugJumpTarget; label: string }[] = [
  { target: "locationQuiz", label: "Location quiz" },
  { target: "crossword", label: "Crossword" },
  { target: "end", label: "End / tier" },
];

interface DebugPhaseBarProps {
  phase: Phase;
  onJump: (target: DebugJumpTarget) => void;
  onReset: () => void;
}

/** Dev-only HUD for skipping intake and jumping straight to minigames. */
export function DebugPhaseBar({ phase, onJump, onReset }: DebugPhaseBarProps) {
  const { voiceOff, toggleVoiceOff } = useDebugVoice();

  return (
    <div
      className="fixed top-14 end-0 z-50 m-3 max-w-[min(100vw-1.5rem,22rem)] border border-foreground bg-background/95 p-3 shadow-sm backdrop-blur-sm"
      aria-label="Debug phase shortcuts"
    >
      <p className="a24-eyebrow text-muted-foreground">Debug — skip intake</p>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
        Active: {phase} {voiceOff ? " · voice APIs off" : null}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant={voiceOff ? "default" : "outline"}
          size="sm"
          onClick={toggleVoiceOff}
          className="debug-phase-bar__btn h-7 rounded-none px-2 text-[10px] uppercase"
        >
          {voiceOff ? "Voice on" : "Voice off"}
        </Button>
        {JUMPS.map(({ target, label }) => (
          <Button
            key={target}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onJump(target)}
            className="debug-phase-bar__btn h-7 rounded-none px-2 text-[10px] uppercase"
          >
            {label}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          className="debug-phase-bar__btn h-7 rounded-none px-2 text-[10px] uppercase"
        >
          Intake
        </Button>
      </div>
    </div>
  );
}
