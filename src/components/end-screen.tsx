"use client";

import { fanTier } from "@/lib/scoring";
import type { Scores } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface EndScreenProps {
  scores: Scores;
  onRestart: () => void;
}

export function EndScreen({ scores, onRestart }: EndScreenProps) {
  const tier = fanTier(scores);
  const total = scores.locationTotal + scores.crosswordTotal;
  const correct = scores.location + scores.crossword;

  return (
    <div className="flex h-full w-full flex-col justify-center">
      <p className="a24-eyebrow text-muted-foreground">Your tier</p>
      <h1 className="a24-title mt-4 max-w-[12ch]">{tier.title}</h1>
      <p className="a24-prose mt-6 text-muted-foreground">{tier.blurb}</p>

      <div className="mt-10 flex flex-wrap gap-8">
        <Stat label="Locations" value={`${scores.location}/${scores.locationTotal}`} />
        <Stat label="Crossword" value={`${scores.crossword}/${scores.crosswordTotal}`} />
        <Stat label="Overall" value={`${correct}/${total}`} />
      </div>

      <Button onClick={onRestart} variant="outline" className="a24-cta mt-12 w-full sm:w-auto">
        Consult the oracle again
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="a24-eyebrow text-muted-foreground">{label}</span>
      <span className="text-[1.375rem] leading-none">{value}</span>
    </div>
  );
}
