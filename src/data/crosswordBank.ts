import type { CrosswordEntry } from "@/lib/types";

/**
 * PLACEHOLDER crossword content for the prototype. Replace these entries with the
 * real clues/answers from the A24 crossword book later — no code changes needed,
 * only this array. Answers must be single alphabetic tokens (length > 1).
 */
export const crosswordBank: CrosswordEntry[] = [
  {
    id: "cw-sandler",
    filmId: "uncut-gems",
    word: "SANDLER",
    clue: "Adam who plays jeweler Howard Ratner",
    difficulty: "easy",
  },
  {
    id: "cw-opal",
    filmId: "uncut-gems",
    word: "OPAL",
    clue: "The uncut gem smuggled out of Ethiopia",
    difficulty: "medium",
  },
  {
    id: "cw-howard",
    filmId: "uncut-gems",
    word: "HOWARD",
    clue: "Ratner, the film's doomed protagonist",
    difficulty: "easy",
  },
  {
    id: "cw-garnett",
    filmId: "uncut-gems",
    word: "GARNETT",
    clue: "NBA star Kevin who plays himself",
    difficulty: "hard",
  },
  {
    id: "cw-safdie",
    filmId: "uncut-gems",
    word: "SAFDIE",
    clue: "Surname of the directing brothers",
    difficulty: "medium",
  },
  {
    id: "cw-connie",
    filmId: "good-time",
    word: "CONNIE",
    clue: "Pattinson's desperate bank robber",
    difficulty: "medium",
  },
  {
    id: "cw-queens",
    filmId: "good-time",
    word: "QUEENS",
    clue: "NYC borough of Good Time's long night",
    difficulty: "easy",
  },
  {
    id: "cw-liminal",
    filmId: "the-backrooms",
    word: "LIMINAL",
    clue: "Unsettling in-between, ___ space",
    difficulty: "medium",
  },
  {
    id: "cw-carpet",
    filmId: "the-backrooms",
    word: "CARPET",
    clue: "Damp yellow flooring of the Backrooms",
    difficulty: "easy",
  },
  {
    id: "cw-noclip",
    filmId: "the-backrooms",
    word: "NOCLIP",
    clue: "To phase through walls, gamer slang",
    difficulty: "hard",
  },
  {
    id: "cw-chiron",
    filmId: "moonlight",
    word: "CHIRON",
    clue: "Moonlight's three-chapter protagonist",
    difficulty: "medium",
  },
  {
    id: "cw-maypole",
    filmId: "midsommar",
    word: "MAYPOLE",
    clue: "Floral pole danced around in Midsommar",
    difficulty: "medium",
  },
  {
    id: "cw-paimon",
    filmId: "hereditary",
    word: "PAIMON",
    clue: "Demon king crowned in Hereditary",
    difficulty: "hard",
  },
  {
    id: "cw-eggers",
    filmId: "the-witch",
    word: "EGGERS",
    clue: "Robert who directed The Witch",
    difficulty: "medium",
  },
];

const crosswordById = new Map(crosswordBank.map((e) => [e.id, e]));

export function getCrosswordEntry(id: string): CrosswordEntry | undefined {
  return crosswordById.get(id);
}
