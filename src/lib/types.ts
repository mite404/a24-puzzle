export type FilmId = string;

export interface Film {
  id: FilmId;
  title: string;
  year: number;
  director: string;
  genres: string[];
  /**
   * Principal cast (actor names), so a puzzle can be built around a shared actor,
   * not only a shared film — see spec `crossword-bank.md` R8. Omitted for films with
   * no named ensemble (e.g. `the-backrooms`).
   */
  cast?: string[];
}

export interface Swatch {
  hex: string;
  name: string;
}

/**
 * A film's color signature, sourced from a still. `stillImageUrl` is where the
 * colors were sampled from; the prototype hardcodes `swatches` (production would
 * run node-vibrant on the still). Only the swatches are rendered in the UI.
 */
export interface Palette {
  filmId: FilmId;
  stillImageUrl: string;
  swatches: Swatch[];
}

export interface FilmLocation {
  id: string;
  filmId: FilmId;
  /** Primary still — quiz hero and collapsed map card. */
  photoUrl: string;
  /** Expanded-card carousel gallery; falls back to film stills when omitted. */
  photoUrls?: string[];
  address: string;
  /** Specific place name on map hover cards (e.g. "St. Barts Cathedral"). */
  venueLabel?: string;
  neighborhood: string;
  lat: number;
  lng: number;
  hint: string;
}

export type Difficulty = "easy" | "medium" | "hard";

export interface CrosswordEntry {
  id: string;
  filmId: FilmId;
  word: string;
  clue: string;
  difficulty: Difficulty;
}

/** A single location-quiz question: one location plus 4 film options to choose from. */
export interface LocationQuestion {
  location: FilmLocation;
  options: FilmId[];
}

/** A word after the layout generator has placed it on the grid (1-indexed coords). */
export interface PlacedWord {
  id: string;
  answer: string;
  clue: string;
  startx: number;
  starty: number;
  orientation: "across" | "down";
  position: number;
}

export interface CrosswordLayout {
  rows: number;
  cols: number;
  words: PlacedWord[];
  /**
   * Bank ids of requested entries the generator could not interlock (returned with
   * `orientation: "none"`). Empty when every requested word reached the grid. Makes the
   * silent drop observable to the caller — see spec `crossword-layout.md` R6.
   */
  droppedIds: string[];
}

/** Structured output of the conversation, emitted by Claude via finalizeExperience. */
export interface ExperienceProfile {
  selectedFilmIds: FilmId[];
  moods: string[];
  crosswordWordIds: string[];
  locationIds: string[];
}

export type Phase =
  | "intake"
  | "generating"
  | "locationQuiz"
  | "crossword"
  | "end";

export interface GamePayload {
  profile: ExperienceProfile | null;
  locations: LocationQuestion[];
  crossword: CrosswordLayout | null;
  crosswordWords: CrosswordEntry[];
}

export interface Scores {
  location: number;
  locationTotal: number;
  crossword: number;
  crosswordTotal: number;
}
