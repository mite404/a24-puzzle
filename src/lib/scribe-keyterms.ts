import { films } from "@/data/films";
import { locations } from "@/data/locations";
import { ORACLE_PERSONA_LIST } from "@/lib/oracle-personas";

/** Scribe realtime client limits (@elevenlabs/client scribe.d.ts). */
const MAX_KEYTERMS = 50;
const MAX_KEYTERM_LENGTH = 20;

const STATIC_TERMS = ["A24"] as const;

/** Spoken shorthand when catalog strings exceed the 20-character keyterm cap. */
const KEYTERM_SHORT_FORMS: Record<string, string> = {
  "Everything Everywhere All at Once": "All at Once",
  "Lotte New York Palace": "Lotte Palace",
};

function splitDirectorParts(director: string): string[] {
  return director
    .split(/\s*&\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function addTerm(terms: Set<string>, value: string | undefined): void {
  const trimmed = value?.trim();
  if (!trimmed) return;
  const short = KEYTERM_SHORT_FORMS[trimmed] ?? trimmed;
  if (short.length > MAX_KEYTERM_LENGTH) return;
  terms.add(short);
}

/**
 * Deduped proper nouns for Scribe realtime bias — film titles, directors,
 * NYC locations, and oracle persona names.
 */
export function buildScribeKeyterms(): string[] {
  const terms = new Set<string>();

  for (const term of STATIC_TERMS) {
    addTerm(terms, term);
  }

  for (const persona of ORACLE_PERSONA_LIST) {
    addTerm(terms, persona.characterName);
    addTerm(terms, persona.filmTitle);
  }

  for (const film of films) {
    addTerm(terms, film.title);
    for (const part of splitDirectorParts(film.director)) {
      addTerm(terms, part);
    }
  }

  for (const location of locations) {
    addTerm(terms, location.neighborhood);
    addTerm(terms, location.venueLabel);
  }

  return [...terms].slice(0, MAX_KEYTERMS);
}
