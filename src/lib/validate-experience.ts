import { getCrosswordEntry } from "@/data/crosswordBank";
import { getFilm } from "@/data/films";
import { getLocation } from "@/data/locations";
import { getPalette } from "@/data/palettes";
import type { ExperienceProfile, FilmId } from "@/lib/types";

export function validateExperienceProfile(
  input: ExperienceProfile,
): { ok: true; profile: ExperienceProfile } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (input.selectedFilmIds.length < 1) {
    errors.push("selectedFilmIds must include at least one film");
  }
  // Placement floor: the Phase 2/3 fuzz measured P(>=8 placed) reaching 100%
  // only at >= 10 requested ids (92% at 9, 70% at 8). Spec crossword-layout.md
  // R1 (>= 8 words placed) is therefore only reliable at >= 10. Upper bound 14
  // keeps the grid sane and still places fully (measured 100% at <= 14).
  if (input.crosswordWordIds.length < 10 || input.crosswordWordIds.length > 14) {
    errors.push(
      `crosswordWordIds must have 10-14 ids (got ${input.crosswordWordIds.length})`,
    );
  }
  for (const id of input.selectedFilmIds) {
    if (!getFilm(id as FilmId)) errors.push(`unknown film: ${id}`);
  }
  for (const id of input.crosswordWordIds) {
    if (!getCrosswordEntry(id)) errors.push(`unknown crossword word: ${id}`);
  }
  for (const id of input.locationIds) {
    if (!getLocation(id)) errors.push(`unknown location: ${id}`);
  }

  return errors.length > 0 ? { ok: false, errors } : { ok: true, profile: input };
}

export function validatePaletteFilmId(
  filmId: string,
): { ok: true; filmId: FilmId } | { ok: false; error: string } {
  if (!getFilm(filmId as FilmId)) {
    return { ok: false, error: `Unknown film id: ${filmId}` };
  }
  if (!getPalette(filmId as FilmId)) {
    return { ok: false, error: `No palette available for film: ${filmId}` };
  }
  return { ok: true, filmId: filmId as FilmId };
}
