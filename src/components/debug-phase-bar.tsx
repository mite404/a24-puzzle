"use client";

import type { DebugJumpTarget } from "@/lib/debug-experience";
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
  return (
    <div
      className="fixed top-14 end-0 z-50 m-3 max-w-[min(100vw-1.5rem,22rem)] border border-foreground bg-background/95 p-3 shadow-sm backdrop-blur-sm"
      aria-label="Debug phase shortcuts"
    >
      <p className="a24-eyebrow text-muted-foreground">Debug — skip intake</p>
      <p className="mt-1 font-mono text-[10px] text-muted-foreground">
        Active: {phase} · also{" "}
        <code className="text-foreground">?debug=crossword</code>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {JUMPS.map(({ target, label }) => (
          <Button
            key={target}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onJump(target)}
            className="h-7 rounded-none px-2 text-[10px] uppercase"
          >
            {label}
          </Button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          className="h-7 rounded-none px-2 text-[10px] uppercase"
        >
          Intake
        </Button>
      </div>
    </div>
  );
}
