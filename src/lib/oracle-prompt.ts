import { films } from "@/data/films";
import { palettes } from "@/data/palettes";
import { locations } from "@/data/locations";
import { crosswordBank } from "@/data/crosswordBank";
import {
  DEFAULT_PERSONA_ID,
  getOraclePersona,
  resolvePersonaId,
  type OraclePersonaId,
} from "@/lib/oracle-personas";

/**
 * Builds the catalog of valid IDs that gets injected into the system prompt so
 * the oracle can only ever reference real films, palettes, locations, and words.
 */
export function buildCatalog(): string {
  const filmLines = films
    .map((f) => `  - ${f.id}: "${f.title}" (${f.year}, dir. ${f.director})`)
    .join("\n");

  const paletteFilmIds = palettes.map((p) => p.filmId).join(", ");

  const locationLines = locations
    .map((l) => `  - ${l.id}: ${l.neighborhood} (${l.filmId})`)
    .join("\n");

  const crosswordLines = crosswordBank
    .map((c) => `  - ${c.id}: ${c.word} (${c.filmId})`)
    .join("\n");

  return [
    "FILMS (use these ids for selectedFilmIds and showPalette.filmId):",
    filmLines,
    "",
    `Films that have a palette available for showPalette: ${paletteFilmIds}`,
    "",
    "LOCATIONS (use these ids for locationIds):",
    locationLines,
    "",
    "CROSSWORD WORDS (use these ids for crosswordWordIds):",
    crosswordLines,
  ].join("\n");
}

export function buildSystemPrompt(
  personaId: OraclePersonaId = DEFAULT_PERSONA_ID,
): string {
  const persona = getOraclePersona(resolvePersonaId(personaId));
  return persona.buildPersonaPrompt(buildCatalog());
}
