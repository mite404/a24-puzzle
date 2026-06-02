"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CrosswordLayout, PlacedWord } from "@/lib/types";
import { Button } from "@/components/ui/button";

interface CrosswordProps {
  layout: CrosswordLayout;
  onComplete: (correct: number) => void;
}

interface Cell {
  solution: string;
  number?: number;
}

type Direction = "across" | "down";

function key(r: number, c: number) {
  return `${r}-${c}`;
}

/** Builds a sparse grid model + ordered clue lists from the placed words. */
function buildGrid(layout: CrosswordLayout) {
  const { rows, cols, words } = layout;
  const grid: (Cell | null)[][] = Array.from({ length: rows }, () =>
    Array<Cell | null>(cols).fill(null),
  );

  for (const w of words) {
    const r0 = w.starty - 1;
    const c0 = w.startx - 1;
    for (let i = 0; i < w.answer.length; i++) {
      const r = w.orientation === "down" ? r0 + i : r0;
      const c = w.orientation === "across" ? c0 + i : c0;
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      grid[r][c] = { solution: w.answer[i], number: grid[r][c]?.number };
    }
    const startCell = grid[r0]?.[c0];
    if (startCell) {
      grid[r0][c0] = { ...startCell, number: w.position };
    }
  }

  const across = words
    .filter((w) => w.orientation === "across")
    .sort((a, b) => a.position - b.position);
  const down = words
    .filter((w) => w.orientation === "down")
    .sort((a, b) => a.position - b.position);

  return { grid, across, down };
}

function wordCells(w: PlacedWord): Array<{ r: number; c: number }> {
  const r0 = w.starty - 1;
  const c0 = w.startx - 1;
  return Array.from({ length: w.answer.length }, (_, i) => ({
    r: w.orientation === "down" ? r0 + i : r0,
    c: w.orientation === "across" ? c0 + i : c0,
  }));
}

export function Crossword({ layout, onComplete }: CrosswordProps) {
  const { grid, across, down } = useMemo(() => buildGrid(layout), [layout]);
  const { rows, cols, words } = layout;

  const [values, setValues] = useState<Record<string, string>>({});
  const [active, setActive] = useState<{ r: number; c: number } | null>(null);
  const [direction, setDirection] = useState<Direction>("across");
  const [result, setResult] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const isCell = (r: number, c: number) =>
    r >= 0 && r < rows && c >= 0 && c < cols && Boolean(grid[r][c]);

  // Focus follows the active cell declaratively. Handlers only move `active`;
  // this effect owns the imperative focus (effects may touch refs, render can't).
  useEffect(() => {
    if (!active) return;
    gridRef.current
      ?.querySelector<HTMLInputElement>(`[data-cell="${key(active.r, active.c)}"]`)
      ?.focus();
  }, [active]);

  // Cells belonging to the active word, for highlighting.
  const activeWordCells = useMemo(() => {
    if (!active) return new Set<string>();
    const match = words.find((w) => {
      if (w.orientation !== direction) return false;
      return wordCells(w).some((p) => p.r === active.r && p.c === active.c);
    });
    if (!match) return new Set<string>();
    return new Set(wordCells(match).map((p) => key(p.r, p.c)));
  }, [active, direction, words]);

  function selectCell(r: number, c: number) {
    if (active && active.r === r && active.c === c) {
      setDirection((d) => (d === "across" ? "down" : "across"));
    } else {
      const acrossAvailable = isCell(r, c - 1) || isCell(r, c + 1);
      const downAvailable = isCell(r - 1, c) || isCell(r + 1, c);
      setDirection(acrossAvailable ? "across" : downAvailable ? "down" : "across");
    }
    setActive({ r, c });
  }

  function handleChange(r: number, c: number, raw: string) {
    const ch = raw.slice(-1).toUpperCase();
    if (ch && !/[A-Z]/.test(ch)) return;
    setValues((prev) => ({ ...prev, [key(r, c)]: ch }));
    if (ch) {
      const nr = direction === "down" ? r + 1 : r;
      const nc = direction === "across" ? c + 1 : c;
      if (isCell(nr, nc)) setActive({ r: nr, c: nc });
    }
  }

  function handleKeyDown(r: number, c: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !values[key(r, c)]) {
      const pr = direction === "down" ? r - 1 : r;
      const pc = direction === "across" ? c - 1 : c;
      if (isCell(pr, pc)) {
        setValues((prev) => ({ ...prev, [key(pr, pc)]: "" }));
        setActive({ r: pr, c: pc });
      }
      return;
    }
    const moves: Record<string, [number, number]> = {
      ArrowUp: [r - 1, c],
      ArrowDown: [r + 1, c],
      ArrowLeft: [r, c - 1],
      ArrowRight: [r, c + 1],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [nr, nc] = moves[e.key];
      if (isCell(nr, nc)) {
        setDirection(e.key === "ArrowUp" || e.key === "ArrowDown" ? "down" : "across");
        setActive({ r: nr, c: nc });
      }
    }
  }

  function check() {
    const correct = words.filter((w) =>
      wordCells(w).every((p) => values[key(p.r, p.c)] === grid[p.r][p.c]?.solution),
    ).length;
    setResult(correct);
    onComplete(correct);
  }

  return (
    <div className="flex w-full flex-col py-2">
      <header className="mb-5">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Round 2 — The A24 Crossword
        </p>
      </header>

      <div className="flex flex-col gap-8 md:flex-row">
        <div
          ref={gridRef}
          className="grid shrink-0 gap-px self-start bg-white/10 p-px"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: rows }).map((_, r) =>
            Array.from({ length: cols }).map((_, c) => {
              const cell = grid[r][c];
              if (!cell) {
                return <div key={key(r, c)} className="size-9 bg-black" />;
              }
              const isActive = active?.r === r && active?.c === c;
              const inWord = activeWordCells.has(key(r, c));
              return (
                <div key={key(r, c)} className="relative size-9">
                  {cell.number !== undefined && (
                    <span className="pointer-events-none absolute left-0.5 top-0 z-10 font-mono text-[8px] text-black/60">
                      {cell.number}
                    </span>
                  )}
                  <input
                    data-cell={key(r, c)}
                    value={values[key(r, c)] ?? ""}
                    onChange={(e) => handleChange(r, c, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(r, c, e)}
                    onFocus={() => selectCell(r, c)}
                    onClick={() => selectCell(r, c)}
                    maxLength={1}
                    disabled={result !== null}
                    aria-label={`Row ${r + 1}, column ${c + 1}`}
                    className={cellClass(isActive, inWord)}
                  />
                </div>
              );
            }),
          )}
        </div>

        <div className="flex-1 space-y-6 text-sm">
          <ClueList title="Across" words={across} />
          <ClueList title="Down" words={down} />
        </div>
      </div>

      <div className="mt-8 flex items-center justify-between">
        {result === null ? (
          <p className="text-sm italic text-muted-foreground">
            Fill what you can. The oracle rewards instinct over certainty.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {result} of {words.length} entries solved.
          </p>
        )}
        <Button onClick={check} disabled={result !== null} className="px-5">
          Reveal my tier
        </Button>
      </div>
    </div>
  );
}

function ClueList({ title, words }: { title: string; words: PlacedWord[] }) {
  if (words.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
        {title}
      </h3>
      <ol className="flex flex-col gap-1.5">
        {words.map((w) => (
          <li key={w.id} className="flex gap-2 text-foreground/75">
            <span className="font-mono text-xs text-muted-foreground">{w.position}.</span>
            <span>{w.clue}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function cellClass(isActive: boolean, inWord: boolean) {
  const base =
    "size-9 bg-white text-center font-mono text-base font-semibold uppercase text-black caret-transparent outline-none";
  if (isActive) return `${base} bg-amber-300`;
  if (inWord) return `${base} bg-amber-100`;
  return base;
}
