import { generateLayout } from "crossword-layout-generator";
import { films } from "@/data/films";
import { locations as allLocations, getLocation } from "@/data/locations";
import { crosswordBank, getCrosswordEntry } from "@/data/crosswordBank";
import type {
  CrosswordEntry,
  CrosswordLayout,
  ExperienceProfile,
  FilmLocation,
  GamePayload,
  LocationQuestion,
  PlacedWord,
} from "@/lib/types";

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Turns selected crossword entries into a placed grid layout. Words the generator
 * could not interlock (orientation "none") are dropped. The third-party generator
 * is chatty on stdout, so console.log is muted for the duration of the call.
 */
export function buildCrosswordLayout(entries: CrosswordEntry[]): CrosswordLayout {
  const input = entries.map((e) => ({
    clue: e.clue,
    answer: e.word.toUpperCase(),
  }));

  const originalLog = console.log;
  console.log = () => {};
  let layout;
  try {
    layout = generateLayout(input);
  } finally {
    console.log = originalLog;
  }

  const words: PlacedWord[] = layout.result
    .filter(
      (w) =>
        w.orientation !== "none" &&
        typeof w.startx === "number" &&
        typeof w.starty === "number" &&
        typeof w.position === "number",
    )
    .map((w) => {
      const entry =
        entries.find(
          (e) => e.word.toUpperCase() === w.answer && e.clue === w.clue,
        ) ?? entries.find((e) => e.word.toUpperCase() === w.answer);
      return {
        id: entry?.id ?? w.answer,
        answer: w.answer,
        clue: w.clue,
        startx: w.startx as number,
        starty: w.starty as number,
        orientation: w.orientation as "across" | "down",
        position: w.position as number,
      };
    });

  return { rows: layout.rows, cols: layout.cols, words };
}

/** Resolves crossword ids from the profile, falling back to a sensible default set. */
export function resolveCrosswordEntries(ids: string[]): CrosswordEntry[] {
  const resolved = ids
    .map((id) => getCrosswordEntry(id))
    .filter((e): e is CrosswordEntry => Boolean(e));

  if (resolved.length >= 4) return resolved;

  // Top up with bank entries not already chosen, until we have a playable puzzle.
  const have = new Set(resolved.map((e) => e.id));
  for (const entry of crosswordBank) {
    if (resolved.length >= 8) break;
    if (!have.has(entry.id)) resolved.push(entry);
  }
  return resolved;
}

/** Resolves location ids from the profile, falling back to a sensible default set. */
export function resolveLocations(ids: string[]): FilmLocation[] {
  const resolved = ids
    .map((id) => getLocation(id))
    .filter((l): l is FilmLocation => Boolean(l));

  if (resolved.length >= 3) return resolved;

  const have = new Set(resolved.map((l) => l.id));
  for (const loc of allLocations) {
    if (resolved.length >= 5) break;
    if (!have.has(loc.id)) resolved.push(loc);
  }
  return resolved;
}

/** Builds quiz questions: each location plus 3 distractor film options. */
export function buildLocationQuestions(locs: FilmLocation[]): LocationQuestion[] {
  const allFilmIds = films.map((f) => f.id);
  return locs.map((location) => {
    const distractors = shuffle(
      allFilmIds.filter((id) => id !== location.filmId),
    ).slice(0, 3);
    const options = shuffle([location.filmId, ...distractors]);
    return { location, options };
  });
}

/** Assembles the full game payload from an oracle profile (or debug fixture). */
export function buildGamePayload(profile: ExperienceProfile): GamePayload {
  const entries = resolveCrosswordEntries(profile.crosswordWordIds);
  const crossword = buildCrosswordLayout(entries);
  const locations = buildLocationQuestions(resolveLocations(profile.locationIds));
  return { profile, locations, crossword, crosswordWords: entries };
}

/** Client fallback when the regenerate API is unavailable. */
export function pickAlternateCrosswordIds(
  profile: ExperienceProfile,
  excludeIds: string[],
  count = 8,
): string[] {
  const exclude = new Set(excludeIds);
  const filmSet = new Set(profile.selectedFilmIds);
  const available = crosswordBank.filter((e) => !exclude.has(e.id));
  const preferred = shuffle(available.filter((e) => filmSet.has(e.filmId)));
  const rest = shuffle(available.filter((e) => !filmSet.has(e.filmId)));
  const picked = [...preferred, ...rest].slice(0, count).map((e) => e.id);

  if (picked.length >= 4) return picked;

  for (const entry of crosswordBank) {
    if (picked.length >= count) break;
    if (!picked.includes(entry.id)) picked.push(entry.id);
  }
  return picked;
}

export function rebuildCrosswordPayload(
  payload: GamePayload,
  crosswordWordIds: string[],
): GamePayload {
  if (!payload.profile) return payload;
  const profile = { ...payload.profile, crosswordWordIds };
  const entries = resolveCrosswordEntries(crosswordWordIds);
  const crossword = buildCrosswordLayout(entries);
  return { ...payload, profile, crossword, crosswordWords: entries };
}
