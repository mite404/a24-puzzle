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
import { AppShell } from "@/components/app-shell";
import { SiteHeader } from "@/components/site-header";
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
    <main className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />

      {phase === "intake" && (
        <AppShell hero centered maxWidth="copy">
          <OracleChat onFinalize={handleFinalize} />
        </AppShell>
      )}

      {phase === "generating" && <Generating />}

      {phase === "locationQuiz" && payload && (
        <AppShell hero maxWidth="game">
          <LocationQuiz questions={payload.locations} onComplete={finishLocations} />
        </AppShell>
      )}

      {phase === "crossword" && payload?.crossword && (
        <AppShell hero maxWidth="game">
          <Crossword layout={payload.crossword} onComplete={finishCrossword} />
        </AppShell>
      )}

      {phase === "end" && (
        <AppShell hero centered maxWidth="copy">
          <EndScreen scores={scores} onRestart={restart} />
        </AppShell>
      )}
    </main>
  );
}

function Generating() {
  return (
    <div className="a24-gutter a24-hero-pad flex min-h-[50dvh] flex-col justify-center gap-3">
      <p className="a24-prose text-2xl italic">I think I see you now.</p>
      <p className="a24-eyebrow text-muted-foreground">Composing your experience</p>
    </div>
  );
}
