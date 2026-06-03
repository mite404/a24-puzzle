"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildGamePayload,
} from "@/lib/game";
import {
  buildDebugPayload,
  DEBUG_EXPERIENCE_ENABLED,
  parseDebugJumpTarget,
  scoresForDebugJump,
  type DebugJumpTarget,
} from "@/lib/debug-experience";
import type {
  ExperienceProfile,
  GamePayload,
  Phase,
  Scores,
} from "@/lib/types";
import { AppShell } from "@/components/app-shell";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { DebugPhaseBar } from "@/components/debug-phase-bar";
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
    const gamePayload = buildGamePayload(profile);
    setPayload(gamePayload);
    setScores({
      ...EMPTY_SCORES,
      locationTotal: gamePayload.locations.length,
      crosswordTotal: gamePayload.crossword?.words.length ?? 0,
    });
    setPhase("generating");
    // A short, deliberate beat so the handoff from conversation to games feels earned.
    setTimeout(() => setPhase("locationQuiz"), 1900);
  }, []);

  const jumpToDebug = useCallback((target: DebugJumpTarget) => {
    const gamePayload = buildDebugPayload();
    setPayload(gamePayload);
    setScores(scoresForDebugJump(target, gamePayload));
    setPhase(target);
  }, []);

  const finishLocations = useCallback((correct: number) => {
    setScores((s) => ({ ...s, location: correct }));
    setPhase("crossword");
  }, []);

  const finishCrossword = useCallback((correct: number) => {
    setScores((s) => ({ ...s, crossword: correct }));
    setPhase("end");
  }, []);

  const [intakeSession, setIntakeSession] = useState(0);

  const restart = useCallback(() => {
    setIntakeSession((n) => n + 1);
    setPayload(null);
    setScores(EMPTY_SCORES);
    setPhase("intake");
  }, []);

  const debugUrlHandled = useRef(false);

  useEffect(() => {
    if (phase !== "intake") return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [phase, intakeSession]);

  useEffect(() => {
    if (!DEBUG_EXPERIENCE_ENABLED || debugUrlHandled.current) return;
    const target = parseDebugJumpTarget(window.location.search);
    if (!target) return;
    debugUrlHandled.current = true;
    jumpToDebug(target);
  }, [jumpToDebug]);

  return (
    <main className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <SiteHeader />

      {DEBUG_EXPERIENCE_ENABLED && (
        <DebugPhaseBar phase={phase} onJump={jumpToDebug} onReset={restart} />
      )}

      {phase === "intake" && (
        <AppShell hero centered maxWidth="copy">
          <OracleChat key={intakeSession} onFinalize={handleFinalize} />
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

      <SiteFooter />
    </main>
  );
}

function Generating() {
  return (
    <div className="a24-gutter a24-hero-pad flex min-h-[50dvh] flex-1 flex-col justify-center">
      <div className="mx-auto flex w-full max-w-[45.6rem] flex-col gap-3">
        <p className="a24-prose text-2xl italic">I think I see you now.</p>
        <p className="a24-meta">Composing your experience</p>
      </div>
    </div>
  );
}
