"use client";

import { useState } from "react";
import Image from "next/image";
import { getFilmTitle } from "@/data/films";
import type { LocationQuestion } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface LocationQuizProps {
  questions: LocationQuestion[];
  onComplete: (correct: number) => void;
}

export function LocationQuiz({ questions, onComplete }: LocationQuizProps) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);

  const question = questions[index];
  const answered = picked !== null;
  const isLast = index === questions.length - 1;

  function pick(filmId: string) {
    if (answered) return;
    setPicked(filmId);
    if (filmId === question.location.filmId) {
      setCorrectCount((c) => c + 1);
    }
  }

  function next() {
    if (isLast) {
      onComplete(correctCount);
      return;
    }
    setIndex((i) => i + 1);
    setPicked(null);
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 py-8">
      <header className="mb-5">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-white/40">
          Round 1 — Where Was This Shot
        </p>
        <p className="mt-1 font-mono text-xs text-white/30">
          {index + 1} / {questions.length}
        </p>
      </header>

      <div className="relative aspect-video w-full overflow-hidden rounded-2xl ring-1 ring-white/10">
        <Image
          src={question.location.photoUrl}
          alt="A filming location somewhere in New York City"
          fill
          sizes="(max-width: 768px) 100vw, 672px"
          className="object-cover"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <p className="font-serif text-sm italic text-white/80">
            {question.location.hint}
          </p>
        </div>
      </div>

      <p className="mt-6 mb-3 font-serif text-lg text-white/90">
        Which A24 film shot here?
      </p>

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
          <p className="font-serif text-sm text-white/60">
            {picked === question.location.filmId
              ? "Correct."
              : `It was ${getFilmTitle(question.location.filmId)}.`}{" "}
            <span className="text-white/40">
              {question.location.neighborhood}
            </span>
          </p>
          <Button
            onClick={next}
            className="rounded-2xl bg-white px-5 text-black hover:bg-white/80"
          >
            {isLast ? "To the crossword" : "Next"}
          </Button>
        </div>
      )}
    </div>
  );
}

function cardClass(answered: boolean, isCorrect: boolean, isPicked: boolean) {
  const base =
    "rounded-2xl border px-4 py-3 text-left font-serif text-base transition-colors";
  if (!answered) {
    return `${base} border-white/15 bg-white/5 text-white/90 hover:border-white/40 hover:bg-white/10`;
  }
  if (isCorrect) {
    return `${base} border-emerald-400/50 bg-emerald-400/10 text-emerald-200`;
  }
  if (isPicked) {
    return `${base} border-red-400/40 bg-red-400/10 text-red-200`;
  }
  return `${base} border-white/10 bg-transparent text-white/30`;
}
