"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Volume2 } from "lucide-react";
import type { CrosswordLayout, PlacedWord } from "@/lib/types";
import { A24CtaButton } from "@/components/a24-cta-button";

interface CrosswordProps {
  layout: CrosswordLayout;
  onComplete: (correct: number) => void;
  onRegenerate?: () => void;
  regenerating?: boolean;
  onActiveClueChange?: (clue: PlacedWord | null) => void;
  onWordFilled?: (clue: PlacedWord) => void;
  onReadClue?: (clue: PlacedWord) => void;
}

interface LetterCell {
  kind: "letter";
  solution: string;
  number?: number;
}

interface BlockCell {
  kind: "block";
}

interface EmptyCell {
  kind: "empty";
}

type GridCell = LetterCell | BlockCell | EmptyCell;

type Direction = "across" | "down";

function key(r: number, c: number) {
  return `${r}-${c}`;
}

function isLetterCell(cell: GridCell | undefined): cell is LetterCell {
  return cell?.kind === "letter";
}

/**
 * Builds a square-padded grid with three cell kinds: letter, block (internal
 * null), empty (transparent padding outside the puzzle bounding box).
 */
function buildGrid(layout: CrosswordLayout) {
  const { rows, cols, words } = layout;
  const tight: (LetterCell | null)[][] = Array.from({ length: rows }, () =>
    Array<LetterCell | null>(cols).fill(null),
  );

  for (const w of words) {
    const r0 = w.starty - 1;
    const c0 = w.startx - 1;
    for (let i = 0; i < w.answer.length; i++) {
      const r = w.orientation === "down" ? r0 + i : r0;
      const c = w.orientation === "across" ? c0 + i : c0;
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      tight[r][c] = { kind: "letter", solution: w.answer[i], number: tight[r][c]?.number };
    }
    const startCell = tight[r0]?.[c0];
    if (startCell) {
      tight[r0][c0] = { ...startCell, number: w.position };
    }
  }

  const size = Math.max(rows, cols);
  const rowOffset = Math.floor((size - rows) / 2);
  const colOffset = Math.floor((size - cols) / 2);

  const grid: GridCell[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => {
      const origR = r - rowOffset;
      const origC = c - colOffset;
      if (origR < 0 || origR >= rows || origC < 0 || origC >= cols) {
        return { kind: "empty" } satisfies EmptyCell;
      }
      const cell = tight[origR][origC];
      if (cell) return cell;
      return { kind: "block" } satisfies BlockCell;
    }),
  );

  const across = words
    .filter((w) => w.orientation === "across")
    .sort((a, b) => a.position - b.position);
  const down = words
    .filter((w) => w.orientation === "down")
    .sort((a, b) => a.position - b.position);

  return { grid, across, down, size, rowOffset, colOffset };
}

function wordCells(
  w: PlacedWord,
  rowOffset: number,
  colOffset: number,
): Array<{ r: number; c: number }> {
  const r0 = w.starty - 1 + rowOffset;
  const c0 = w.startx - 1 + colOffset;
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

export function Crossword({
  layout,
  onComplete,
  onRegenerate,
  regenerating = false,
  onActiveClueChange,
  onWordFilled,
  onReadClue,
}: CrosswordProps) {
  const { grid, across, down, size, rowOffset, colOffset } = useMemo(
    () => buildGrid(layout),
    [layout],
  );
  const { words } = layout;

  const [values, setValues] = useState<Record<string, string>>({});
  const [active, setActive] = useState<{ r: number; c: number } | null>(null);
  const [direction, setDirection] = useState<Direction>("across");
  const [result, setResult] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef(new Map<string, HTMLInputElement>());
  const directionRef = useRef<Direction>(direction);
  const prevActiveWordIdRef = useRef<string | null>(null);
  const fillFingerprintsRef = useRef(new Map<string, string>());

  useEffect(() => {
    directionRef.current = direction;
  }, [direction]);

  const isCell = (r: number, c: number) => isLetterCell(grid[r]?.[c]);

  const activeWordCells = useMemo(() => {
    if (!active) return new Set<string>();
    const match = words.find((w) => {
      if (w.orientation !== direction) return false;
      return wordCells(w, rowOffset, colOffset).some(
        (p) => p.r === active.r && p.c === active.c,
      );
    });
    if (!match) return new Set<string>();
    return new Set(
      wordCells(match, rowOffset, colOffset).map((p) => key(p.r, p.c)),
    );
  }, [active, direction, words, rowOffset, colOffset]);

  const activeWord = useMemo((): PlacedWord | null => {
    if (!active) return null;
    return (
      words.find((w) => {
        if (w.orientation !== direction) return false;
        return wordCells(w, rowOffset, colOffset).some(
          (p) => p.r === active.r && p.c === active.c,
        );
      }) ?? null
    );
  }, [active, direction, words, rowOffset, colOffset]);

  useEffect(() => {
    if (!onActiveClueChange) return;
    const id = activeWord?.id ?? null;
    if (id === prevActiveWordIdRef.current) return;
    prevActiveWordIdRef.current = id;
    onActiveClueChange(activeWord);
  }, [activeWord, onActiveClueChange]);

  useEffect(() => {
    if (!activeWord || !onWordFilled) return;

    const cells = wordCells(activeWord, rowOffset, colOffset);
    const fingerprint = cells
      .map((p) => values[key(p.r, p.c)] ?? "")
      .join("|");
    const filled = cells.every((p) => {
      const letter = values[key(p.r, p.c)];
      return typeof letter === "string" && letter.trim().length > 0;
    });

    const prev = fillFingerprintsRef.current.get(activeWord.id);
    if (filled && prev !== fingerprint) {
      onWordFilled(activeWord);
      fillFingerprintsRef.current.set(activeWord.id, fingerprint);
    } else if (!filled) {
      fillFingerprintsRef.current.delete(activeWord.id);
    }
  }, [values, activeWord, onWordFilled, rowOffset, colOffset]);

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
    const ch = raw.slice(-1);
    if (!ch || !/[a-zA-Z]/.test(ch)) {
      if (!raw) setValues((prev) => ({ ...prev, [key(r, c)]: "" }));
      return;
    }
    commitLetter(r, c, ch);
  }

  function check() {
    const correct = words.filter((w) =>
      wordCells(w, rowOffset, colOffset).every((p) => {
        const cell = grid[p.r][p.c];
        return isLetterCell(cell) && values[key(p.r, p.c)] === cell.solution;
      }),
    ).length;
    setResult(correct);
    onComplete(correct);
  }

  return (
    <div className="relative flex w-full flex-col py-2">
      {regenerating ? (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-background/80 backdrop-blur-[2px]"
          aria-live="polite"
          aria-busy="true"
        >
          <p className="a24-prose text-lg italic">The oracle is composing a new puzzle</p>
          <p className="a24-meta text-muted-foreground">
            Pulling clues from your conversation&hellip;
          </p>
        </div>
      ) : null}

      <header className="mb-5 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <p className="a24-eyebrow text-muted-foreground">Round 2 — The A24 Crossword</p>
        {onRegenerate && result === null ? (
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
            onClick={onRegenerate}
            disabled={regenerating}
          >
            Regenerate from conversation
          </button>
        ) : null}
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-8 md:flex-row">
        <div className="relative z-10 mx-auto w-full md:flex md:flex-1 md:items-start md:justify-center">
          <div
            ref={gridRef}
            className="crossword-grid mx-auto grid aspect-square w-full max-w-[min(72vw,55dvh,28rem)]"
            style={{
              gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
            }}
          >
            {grid.map((row, r) =>
              row.map((cell, c) => {
                if (cell.kind === "empty") {
                  return <div key={key(r, c)} aria-hidden className="min-h-0" />;
                }
                if (cell.kind === "block") {
                  return (
                    <div
                      key={key(r, c)}
                      aria-hidden
                      className="aspect-square min-h-0 w-full bg-black"
                    />
                  );
                }

                const isActive = active?.r === r && active?.c === c;
                const inWord = activeWordCells.has(key(r, c));
                return (
                  <div
                    key={key(r, c)}
                    className="crossword-letter-cell relative aspect-square min-h-0 w-full"
                  >
                    {cell.number !== undefined && (
                      <span className="pointer-events-none absolute left-[8%] top-[6%] z-10 font-mono text-[clamp(0.4rem,18%,0.55rem)] leading-none text-black/60">
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
        </div>

        <div className="flex-1 space-y-6 text-sm">
          <ClueList
            title="Across"
            words={across}
            activeWordId={activeWord?.orientation === "across" ? activeWord.id : null}
            onReadClue={onReadClue}
          />
          <ClueList
            title="Down"
            words={down}
            activeWordId={activeWord?.orientation === "down" ? activeWord.id : null}
            onReadClue={onReadClue}
          />
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

function ClueList({
  title,
  words,
  activeWordId = null,
  onReadClue,
}: {
  title: string;
  words: PlacedWord[];
  activeWordId?: string | null;
  onReadClue?: (clue: PlacedWord) => void;
}) {
  if (words.length === 0) return null;
  return (
    <div>
      <h3 className="a24-eyebrow mb-2 text-muted-foreground">{title}</h3>
      <ol className="flex flex-col gap-1.5">
        {words.map((w) => {
          const isActive = w.id === activeWordId;
          return (
            <li
              key={w.id}
              className={
                isActive
                  ? "flex gap-2 rounded-sm bg-amber-100/80 px-1 py-0.5 text-foreground"
                  : "flex gap-2 text-foreground/75"
              }
            >
              <span className="font-mono text-xs text-muted-foreground">
                {w.position}.
              </span>
              <span className="flex-1">{w.clue}</span>
              {isActive && onReadClue ? (
                <button
                  type="button"
                  className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`Read clue ${w.position} aloud`}
                  onClick={() => onReadClue(w)}
                >
                  <Volume2 className="size-5" aria-hidden />
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function cellClass(isActive: boolean, inWord: boolean) {
  const base =
    "aspect-square h-full min-h-0 w-full bg-white text-center font-mono text-[clamp(0.65rem,4vw,1rem)] font-semibold uppercase text-black caret-transparent outline-none";
  if (isActive) return `${base} bg-amber-300`;
  if (inWord) return `${base} bg-amber-100`;
  return base;
}
