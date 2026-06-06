import type { OraclePersonaId } from "@/lib/oracle-personas";

export interface PersonaQuips {
  clueRead: string[];
  idle20: string[];
  idle45: string[];
  completed: string[];
}

export const CROSSWORD_ORACLE_QUIPS: Record<OraclePersonaId, PersonaQuips> = {
  ladybird_mom: {
    clueRead: [
      "Okay — listen to this one: {clue}",
      "Here's your clue, honey: {clue}",
      "The cards say: {clue}",
    ],
    idle20: [
      "The cards are getting a little impatient.",
      "You've been sitting on that one — want to try a letter?",
      "I'm still here if you need a nudge.",
    ],
    idle45: [
      "That clue isn't going to solve itself, sweetheart.",
      "The cards are tapping their fingers now.",
      "Maybe walk around the grid and come back to this one?",
    ],
    completed: [
      "Hmmmm.",
      "Noted.",
      "Okay… I see what you did there.",
      "…are you sure?",
      "Interesting choice.",
    ],
  },
  witch: {
    clueRead: [
      "The cards reveal: {clue}",
      "Mark this omen: {clue}",
      "Hear what the grid whispers — {clue}",
    ],
    idle20: [
      "The cards grow impatient.",
      "Time passes. The clue does not.",
      "Thou lingerest overmuch upon this riddle.",
    ],
    idle45: [
      "Even the cards have lost patience with thee.",
      "The answer will not crawl from the parchment unaided.",
      "Speak a letter, or the grid shall keep its secret.",
    ],
    completed: [
      "Hmmmm.",
      "Noted.",
      "The cards stir.",
      "…are you sure?",
      "So it is written — for now.",
    ],
  },
  materialist: {
    clueRead: [
      "Clue: {clue}",
      "Read it back to yourself — {clue}",
      "Here's the prompt: {clue}",
    ],
    idle20: [
      "You've been on that clue a while.",
      "Nothing wrong with a pause — but the grid's still waiting.",
      "Try a letter. Worst case you're wrong.",
    ],
    idle45: [
      "At some point you have to commit to a letter.",
      "The clue isn't getting easier while you stare at it.",
      "Move. Even a wrong guess gives you information.",
    ],
    completed: [
      "Hmmmm.",
      "Noted.",
      "Okay.",
      "…are you sure?",
      "That's a choice.",
    ],
  },
};

/** Never return the same line twice in a row. */
export function pickQuip(pool: string[], lastSpoken?: string): string {
  if (pool.length === 0) return "";
  if (pool.length === 1) return pool[0] ?? "";
  const candidates =
    lastSpoken !== undefined
      ? pool.filter((line) => line !== lastSpoken)
      : pool;
  const pickFrom = candidates.length > 0 ? candidates : pool;
  const index = Math.floor(Math.random() * pickFrom.length);
  return pickFrom[index] ?? pool[0] ?? "";
}

export function formatClueRead(template: string, clue: string): string {
  return template.replace("{clue}", clue);
}
