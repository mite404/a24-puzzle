"use client";

import { useMemo, useRef, useState } from "react";
import type { CrosswordLayout, PlacedWord } from "@/lib/types";
import { A24CtaButton } from "@/components/a24-cta-button";

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

function nextCell(
  r: number,
  c: number,
  direction: Direction,
): { r: number; c: number } {
  return direction === "down" ? { r: r + 1, c } : { r, c: c + 1 };
}

function prevCell(
  r: number,
  c: number,
  direction: Direction,
): { r: number; c: number } {
  return direction === "down" ? { r: r - 1, c } : { r, c: c - 1 };
}

export function Crossword({ layout, onComplete }: CrosswordProps) {
  const { grid, across, down } = useMemo(() => buildGrid(layout), [layout]);
  const { rows, cols, words } = layout;

  const [values, setValues] = useState<Record<string, string>>({});
  const [active, setActive] = useState<{ r: number; c: number } | null>(null);
  const [direction, setDirection] = useState<Direction>("across");
  const [result, setResult] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const directionRef = useRef<Direction>(direction);
  directionRef.current = direction;

  const isCell = (r: number, c: number) =>
    r >= 0 && r < rows && c >= 0 && c < cols && Boolean(grid[r][c]);

  const activeWordCells = useMemo(() => {
    if (!active) return new Set<string>();
    const match = words.find((w) => {
      if (w.orientation !== direction) return false;
      return wordCells(w).some((p) => p.r === active.r && p.c === active.c);
    });
    if (!match) return new Set<string>();
    return new Set(wordCells(match).map((p) => key(p.r, p.c)));
  }, [active, direction, words]);

  function focusCell(r: number, c: number) {
    setActive({ r, c });
    inputRefs.current.get(key(r, c))?.focus();
  }

  function defaultDirectionFor(r: number, c: number): Direction {
    const acrossAvailable = isCell(r, c - 1) || isCell(r, c + 1);
    const downAvailable = isCell(r - 1, c) || isCell(r + 1, c);
    return acrossAvailable ? "across" : downAvailable ? "down" : "across";
  }

  function setDirectionSync(next: Direction) {
    directionRef.current = next;
    setDirection(next);
  }

  function selectCell(r: number, c: number, preferred?: Direction) {
    const acrossAvailable = isCell(r, c - 1) || isCell(r, c + 1);
    const downAvailable = isCell(r - 1, c) || isCell(r + 1, c);
    let nextDirection = preferred ?? defaultDirectionFor(r, c);
    if (preferred === "down" && !downAvailable) nextDirection = "across";
    if (preferred === "across" && !acrossAvailable) nextDirection = "down";
    setDirectionSync(nextDirection);
    focusCell(r, c);
  }

  function toggleDirectionAt(r: number, c: number) {
    const acrossAvailable = isCell(r, c - 1) || isCell(r, c + 1);
    const downAvailable = isCell(r - 1, c) || isCell(r + 1, c);
    const current = directionRef.current;
    let next = current;
    if (current === "across" && downAvailable) next = "down";
    else if (current === "down" && acrossAvailable) next = "across";
    setDirectionSync(next);
    focusCell(r, c);
  }

  function commitLetter(r: number, c: number, ch: string) {
    const letter = ch.toUpperCase();
    if (!/[A-Z]/.test(letter)) return;

    console.log("[crossword] input", {
      row: r + 1,
      col: c + 1,
      char: letter,
      direction: directionRef.current,
    });

    setValues((prev) => ({ ...prev, [key(r, c)]: letter }));

    const { r: nr, c: nc } = nextCell(r, c, directionRef.current);
    if (isCell(nr, nc)) focusCell(nr, nc);
  }

  function handleKeyDown(r: number, c: number, e: React.KeyboardEvent) {
    if (e.key.length === 1 && /[a-zA-Z]/.test(e.key)) {
      e.preventDefault();
      commitLetter(r, c, e.key);
      return;
    }

    if (e.key === "Backspace") {
      e.preventDefault();
      if (values[key(r, c)]) {
        setValues((prev) => ({ ...prev, [key(r, c)]: "" }));
        return;
      }
      const { r: pr, c: pc } = prevCell(r, c, directionRef.current);
      if (isCell(pr, pc)) {
        setValues((prev) => ({ ...prev, [key(pr, pc)]: "" }));
        focusCell(pr, pc);
      }
      return;
    }

    const moves: Record<string, [number, number, Direction]> = {
      ArrowUp: [r - 1, c, "down"],
      ArrowDown: [r + 1, c, "down"],
      ArrowLeft: [r, c - 1, "across"],
      ArrowRight: [r, c + 1, "across"],
    };
    if (moves[e.key]) {
      e.preventDefault();
      const [nr, nc, dir] = moves[e.key];
      if (isCell(nr, nc)) selectCell(nr, nc, dir);
    }
  }

  function handleChange(r: number, c: number, raw: string) {
    // Mobile / IME paste — desktop letters go through onKeyDown.
    const ch = raw.slice(-1);
    if (!ch || !/[a-zA-Z]/.test(ch)) {
      if (!raw) setValues((prev) => ({ ...prev, [key(r, c)]: "" }));
      return;
    }
    commitLetter(r, c, ch);
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
      <header className="mb-5 shrink-0">
        <p className="a24-eyebrow text-muted-foreground">Round 2 — The A24 Crossword</p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-8 md:flex-row">
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
                    ref={(el) => {
                      const k = key(r, c);
                      if (el) inputRefs.current.set(k, el);
                      else inputRefs.current.delete(k);
                    }}
                    data-cell={key(r, c)}
                    value={values[key(r, c)] ?? ""}
                    onChange={(e) => handleChange(r, c, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(r, c, e)}
                    onFocus={() => {
                      if (active?.r !== r || active?.c !== c) {
                        setActive({ r, c });
                      }
                    }}
                    onClick={() => {
                      if (active?.r === r && active?.c === c) {
                        toggleDirectionAt(r, c);
                      } else {
                        selectCell(r, c);
                      }
                    }}
                    maxLength={1}
                    disabled={result !== null}
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    inputMode="text"
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

      <div className="mt-8 flex shrink-0 items-center justify-between">
        {result === null ? (
          <p className="text-sm italic text-muted-foreground">
            Fill what you can. The oracle rewards instinct over certainty.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {result} of {words.length} entries solved.
          </p>
        )}
        <A24CtaButton onClick={check} disabled={result !== null}>
          Reveal my tier
        </A24CtaButton>
      </div>

      <CrosswordLegend />
    </div>
  );
}

function CrosswordLegend() {
  return (
    <section
      className="mt-12 border-t border-foreground pt-6"
      aria-label="Crossword controls"
    >
      <div className="text-foreground/80">
        <div className="a24-prose max-w-none">
          <p className="a24-eyebrow mb-2 text-muted-foreground">How to play</p>
          <ul className="flex flex-col gap-1.5 text-sm md:flex-row md:flex-wrap md:gap-x-6 md:gap-y-1.5">
            <li>
              <strong className="font-medium text-foreground">A–Z</strong> — type one
              letter; the cursor moves along the highlighted word (across or down).
            </li>
            <li>
              <strong className="font-medium text-foreground">Backspace</strong> —
              clears the active square; if it is already empty, moves back and clears
              the previous letter in that word.
            </li>
            <li>
              <strong className="font-medium text-foreground">Arrow keys</strong> —
              move between squares; up/down select a down word, left/right an across
              word.
            </li>
            <li>
              <strong className="font-medium text-foreground">Click a square twice</strong>{" "}
              — switch between across and down for that cell.
            </li>
            <li>
              Use the clue lists for hints.{" "}
              <strong className="font-medium text-foreground">Reveal my tier</strong>{" "}
              scores both rounds and gives you an A24 fan tier — you do not need every
              answer.
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function ClueList({ title, words }: { title: string; words: PlacedWord[] }) {
  if (words.length === 0) return null;
  return (
    <div>
      <h3 className="a24-eyebrow mb-2 text-muted-foreground">{title}</h3>
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
