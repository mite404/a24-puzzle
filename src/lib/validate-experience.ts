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
