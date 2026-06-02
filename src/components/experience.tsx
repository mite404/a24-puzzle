"use client";

import { useCallback, useState } from "react";
import {
  buildCrosswordLayout,
  buildLocationQuestions,
  resolveCrosswordEntries,
  resolveLocations,
} from "@/lib/game";
import type {
  ExperienceProfile,
  GamePayload,
  Phase,
  Scores,
} from "@/lib/types";
import { OracleChat } from "@/components/intake/oracle-chat";
import { LocationQuiz } from "@/components/games/location-quiz";
import { Crossword } from "@/components/games/crossword";
import { EndScreen } from "@/components/end-screen";

const EMPTY_SCORES: Scores = {
  location: 0,
  locationTotal: 0,
  crossword: 0,
  crosswordTotal: 0,
};

export function Experience() {
  const [phase, setPhase] = useState<Phase>("intake");
  const [payload, setPayload] = useState<GamePayload | null>(null);
  const [scores, setScores] = useState<Scores>(EMPTY_SCORES);

  const handleFinalize = useCallback((profile: ExperienceProfile) => {
    const entries = resolveCrosswordEntries(profile.crosswordWordIds);
    const crossword = buildCrosswordLayout(entries);
    const locations = buildLocationQuestions(resolveLocations(profile.locationIds));

    setPayload({ profile, locations, crossword, crosswordWords: entries });
    setScores({
      ...EMPTY_SCORES,
      locationTotal: locations.length,
      crosswordTotal: crossword.words.length,
    });
    setPhase("generating");
    // A short, deliberate beat so the handoff from conversation to games feels earned.
    setTimeout(() => setPhase("locationQuiz"), 1900);
  }, []);

  const finishLocations = useCallback((correct: number) => {
    setScores((s) => ({ ...s, location: correct }));
    setPhase("crossword");
  }, []);

  const finishCrossword = useCallback((correct: number) => {
    setScores((s) => ({ ...s, crossword: correct }));
    setPhase("end");
  }, []);

  const restart = useCallback(() => {
    setPayload(null);
    setScores(EMPTY_SCORES);
    setPhase("intake");
  }, []);

  return (
    <main className="dark relative flex min-h-dvh flex-col bg-black text-white">
      {phase === "intake" && <OracleChat onFinalize={handleFinalize} />}

      {phase === "generating" && <Generating />}

      {phase === "locationQuiz" && payload && (
        <LocationQuiz questions={payload.locations} onComplete={finishLocations} />
      )}

      {phase === "crossword" && payload?.crossword && (
        <Crossword layout={payload.crossword} onComplete={finishCrossword} />
      )}

      {phase === "end" && <EndScreen scores={scores} onRestart={restart} />}
    </main>
  );
}

function Generating() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
      <p className="font-serif text-2xl italic text-white/80">
        I think I see you now.
      </p>
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/40">
        composing your experience
      </p>
    </div>
  );
}
