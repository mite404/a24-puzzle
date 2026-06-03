"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { getFilmTitle } from "@/data/films";
import { locations as allLocations } from "@/data/locations";
import { getNearbyLocations } from "@/lib/geo";
import type { LocationQuestion } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { LocationMap } from "@/components/games/location-map";

const MAP_THRESHOLD = 3;

interface LocationQuizProps {
  questions: LocationQuestion[];
  onComplete: (correct: number) => void;
}

export function LocationQuiz({ questions, onComplete }: LocationQuizProps) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [showMap, setShowMap] = useState(false);

  const question = questions[index];
  const answered = picked !== null;
  const wasCorrect = picked === question.location.filmId;

  const shouldRevealMap =
    answered && (!wasCorrect || index + 1 >= MAP_THRESHOLD);

  const nearbyLocations = useMemo(
    () => getNearbyLocations(question.location, allLocations),
    [question.location],
  );

  function pick(filmId: string) {
    if (answered) return;
    setPicked(filmId);
    const correct = filmId === question.location.filmId;
    if (correct) setCorrectCount((c) => c + 1);

    if (!correct || index + 1 >= MAP_THRESHOLD) {
      setTimeout(() => setShowMap(true), 600);
    }
  }

  function next() {
    setIndex((i) => i + 1);
    setPicked(null);
    setShowMap(false);
  }

  return (
    <div className="flex w-full flex-col py-2">
      <header className="mb-5">
        <p className="a24-eyebrow text-muted-foreground">
          Round 1 — Where Was This Shot
        </p>
        <p className="a24-eyebrow mt-2 text-muted-foreground/70">
          {index + 1} / {Math.min(questions.length, MAP_THRESHOLD)}
        </p>
      </header>

      <div className="relative aspect-video w-full overflow-hidden ring-1 ring-foreground">
        <Image
          src={question.location.photoUrl}
          alt="A filming location somewhere in New York City"
          fill
          sizes="(max-width: 768px) 100vw, 672px"
          className="object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <p className="text-sm italic text-foreground/80">
            {question.location.hint}
          </p>
        </div>
      </div>

      <p className="a24-prose mt-8 mb-4">Which A24 film shot here?</p>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {question.options.map((filmId) => {
          const isCorrect = filmId === question.location.filmId;
          const isPicked = filmId === picked;
          return (
            <button
              key={filmId}
              onClick={() => pick(filmId)}
              disabled={answered}
              className={cardClass(answered, isCorrect, isPicked)}
            >
              {getFilmTitle(filmId)}
            </button>
          );
        })}
      </div>

      {answered && (
        <div className="mt-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {wasCorrect
              ? "Correct."
              : `It was ${getFilmTitle(question.location.filmId)}.`}{" "}
            <span className="text-muted-foreground/70">
              {question.location.neighborhood}
            </span>
          </p>

          {!shouldRevealMap && (
            <Button
              onClick={next}
              variant="outline"
              className="a24-cta h-auto shrink-0"
            >
              Next
            </Button>
          )}
        </div>
      )}

      {/* Map reveal — slides in after wrong answer or after 3 correct */}
      <div
        className={`mt-8 transition-all duration-700 ease-out ${
          showMap
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-8 opacity-0"
        }`}
      >
        {showMap && (
          <LocationMap
            heroLocation={question.location}
            nearbyLocations={nearbyLocations}
            onContinue={() => onComplete(correctCount)}
          />
        )}
      </div>
    </div>
  );
}

function cardClass(answered: boolean, isCorrect: boolean, isPicked: boolean) {
  const base =
    "rounded-none border px-4 py-3 text-left text-base transition-colors";
  if (!answered) {
    return `${base} border-foreground bg-transparent hover:bg-foreground hover:text-background`;
  }
  if (isCorrect) {
    return `${base} border-emerald-400/50 bg-emerald-400/10 text-emerald-200`;
  }
  if (isPicked) {
    return `${base} border-red-400/40 bg-red-400/10 text-red-200`;
  }
  return `${base} border-foreground/30 bg-transparent text-muted-foreground`;
}
