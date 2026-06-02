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
    <div className="mx-auto flex h-full w-full max-w-xl flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.4em] text-white/40">
        Your tier
      </p>
      <h1 className="mt-4 font-serif text-5xl font-medium text-white">
        {tier.title}
      </h1>
      <p className="mt-5 max-w-md font-serif text-lg italic leading-relaxed text-white/70">
        {tier.blurb}
      </p>

      <div className="mt-10 flex gap-8 font-mono text-xs uppercase tracking-widest text-white/50">
        <Stat label="Locations" value={`${scores.location}/${scores.locationTotal}`} />
        <Stat label="Crossword" value={`${scores.crossword}/${scores.crosswordTotal}`} />
        <Stat label="Overall" value={`${correct}/${total}`} />
      </div>

      <Button
        onClick={onRestart}
        variant="outline"
        className="mt-12 rounded-2xl border-white/20 bg-transparent px-6 text-white hover:bg-white/10 hover:text-white"
      >
        Consult the oracle again
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-white/30">{label}</span>
      <span className="text-base text-white/80">{value}</span>
    </div>
  );
}
