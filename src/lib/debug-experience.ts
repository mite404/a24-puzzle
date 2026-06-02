import { crosswordBank } from "@/data/crosswordBank";
import { buildGamePayload } from "@/lib/game";
import type { ExperienceProfile, GamePayload, Phase, Scores } from "@/lib/types";

/** Dev-only shortcuts to minigame phases without running the oracle chat. */
export const DEBUG_EXPERIENCE_ENABLED =
  process.env.NODE_ENV === "development";

export type DebugJumpTarget = Extract<
  Phase,
  "locationQuiz" | "crossword" | "end"
>;

/** Fixture profile — same assembly path as a real finalizeExperience call. */
export const DEBUG_PROFILE: ExperienceProfile = {
  selectedFilmIds: ["uncut-gems", "moonlight", "good-time"],
  moods: ["debug fixture"],
  crosswordWordIds: crosswordBank.slice(0, 8).map((e) => e.id),
  locationIds: [
    "ug-diamond-district",
    "ug-midtown",
    "br-bushwick",
    "br-lic",
    "br-gowanus",
  ],
};

export function buildDebugPayload(): GamePayload {
  return buildGamePayload(DEBUG_PROFILE);
}

export function emptyScoresForPayload(payload: GamePayload): Scores {
  return {
    location: 0,
    locationTotal: payload.locations.length,
    crossword: 0,
    crosswordTotal: payload.crossword?.words.length ?? 0,
  };
}

export function scoresForDebugJump(
  target: DebugJumpTarget,
  payload: GamePayload,
): Scores {
  const base = emptyScoresForPayload(payload);
  if (target === "locationQuiz") return base;

  const locationDone = Math.max(1, Math.floor(base.locationTotal * 0.6));
  if (target === "crossword") {
    return { ...base, location: locationDone };
  }

  const crosswordDone = Math.max(1, Math.floor(base.crosswordTotal * 0.65));
  return {
    ...base,
    location: locationDone,
    crossword: crosswordDone,
  };
}

/** `?debug=crossword` | `location` | `end` */
export function parseDebugJumpTarget(
  search: string,
): DebugJumpTarget | null {
  const value = new URLSearchParams(search).get("debug")?.toLowerCase();
  if (value === "location" || value === "locationquiz") return "locationQuiz";
  if (value === "crossword") return "crossword";
  if (value === "end") return "end";
  return null;
}
