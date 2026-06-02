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
    <div className="flex h-full w-full flex-col items-center justify-center text-center">
      <p className="font-mono text-xs uppercase tracking-[0.4em] text-muted-foreground">
        Your tier
      </p>
      <h1 className="mt-4 text-5xl font-medium text-foreground">
        {tier.title}
      </h1>
      <p className="mt-5 max-w-md text-lg italic leading-relaxed text-muted-foreground">
        {tier.blurb}
      </p>

      <div className="mt-10 flex gap-8 font-mono text-xs uppercase tracking-widest text-muted-foreground">
        <Stat label="Locations" value={`${scores.location}/${scores.locationTotal}`} />
        <Stat label="Crossword" value={`${scores.crossword}/${scores.crosswordTotal}`} />
        <Stat label="Overall" value={`${correct}/${total}`} />
      </div>

      <Button onClick={onRestart} variant="outline" className="mt-12 px-6">
        Consult the oracle again
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground/70">{label}</span>
      <span className="text-base text-foreground/80">{value}</span>
    </div>
  );
}
