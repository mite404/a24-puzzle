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
  // --- moonlight (Barry Jenkins, 2016) ---
  {
    id: "cw-juan",
    filmId: "moonlight",
    word: "JUAN",
    clue: "Mahershala Ali's drug-dealer mentor",
    difficulty: "easy",
  },
  {
    id: "cw-kevin",
    filmId: "moonlight",
    word: "KEVIN",
    clue: "Chiron's schoolfriend and first love",
    difficulty: "easy",
  },
  {
    id: "cw-paula",
    filmId: "moonlight",
    word: "PAULA",
    clue: "Chiron's mother, battling addiction",
    difficulty: "medium",
  },
  {
    id: "cw-teresa",
    filmId: "moonlight",
    word: "TERESA",
    clue: "Juan's girlfriend, played by Janelle Monáe",
    difficulty: "medium",
  },
  {
    id: "cw-black",
    filmId: "moonlight",
    word: "BLACK",
    clue: "Chiron's adult nickname and the final chapter",
    difficulty: "medium",
  },
  {
    id: "cw-little",
    filmId: "moonlight",
    word: "LITTLE",
    clue: "Young Chiron's nickname, the opening chapter",
    difficulty: "medium",
  },
  // --- hereditary (Ari Aster, 2018) ---
  {
    id: "cw-annie",
    filmId: "hereditary",
    word: "ANNIE",
    clue: "Toni Collette's miniaturist matriarch",
    difficulty: "easy",
  },
  {
    id: "cw-peter",
    filmId: "hereditary",
    word: "PETER",
    clue: "The Graham family's teenage son",
    difficulty: "easy",
  },
  {
    id: "cw-charlie",
    filmId: "hereditary",
    word: "CHARLIE",
    clue: "Annie's withdrawn young daughter",
    difficulty: "medium",
  },
  {
    id: "cw-steve",
    filmId: "hereditary",
    word: "STEVE",
    clue: "Gabriel Byrne's steady patriarch",
    difficulty: "medium",
  },
  {
    id: "cw-joan",
    filmId: "hereditary",
    word: "JOAN",
    clue: "Grieving stranger Annie meets in a support group",
    difficulty: "medium",
  },
  {
    id: "cw-miniatures",
    filmId: "hereditary",
    word: "MINIATURES",
    clue: "Detailed dioramas Annie builds for a living",
    difficulty: "hard",
  },
  // --- midsommar (Ari Aster, 2019) ---
  {
    id: "cw-dani",
    filmId: "midsommar",
    word: "DANI",
    clue: "Florence Pugh's grieving protagonist",
    difficulty: "easy",
  },
  {
    id: "cw-christian",
    filmId: "midsommar",
    word: "CHRISTIAN",
    clue: "Dani's distant boyfriend",
    difficulty: "easy",
  },
  {
    id: "cw-pelle",
    filmId: "midsommar",
    word: "PELLE",
    clue: "Swedish friend who invites the group north",
    difficulty: "medium",
  },
  {
    id: "cw-sweden",
    filmId: "midsommar",
    word: "SWEDEN",
    clue: "Country hosting the midsummer festival",
    difficulty: "easy",
  },
  {
    id: "cw-harga",
    filmId: "midsommar",
    word: "HARGA",
    clue: "The isolated commune (the Hårga)",
    difficulty: "hard",
  },
  {
    id: "cw-solstice",
    filmId: "midsommar",
    word: "SOLSTICE",
    clue: "Midsummer sun event the festival marks",
    difficulty: "medium",
  },
];

const crosswordById = new Map(crosswordBank.map((e) => [e.id, e]));

export function getCrosswordEntry(id: string): CrosswordEntry | undefined {
  return crosswordById.get(id);
}
