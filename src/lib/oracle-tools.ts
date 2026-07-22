import { z } from "zod";
import {
  tool,
  type InferUITools,
  type UIDataTypes,
  type UIMessage,
} from "ai";
import {
  validateExperienceProfile,
  validatePaletteFilmId,
} from "@/lib/validate-experience";

/**
 * Oracle tools. Each has an `execute` so every tool call gets a result in the
 * message history (required for multi-turn chat). The UI still renders palette
 * cards and phase transitions from each tool part's `input`.
 */
export const oracleTools = {
  showPalette: tool({
    description:
      "Show the user a color palette pulled from a specific film's stills to gauge their mood. Use this 2-3 times across the conversation to test how a film's colors land against how they say they're feeling. Prefer films that might surprise or expand their taste.",
    inputSchema: z.object({
      filmId: z
        .string()
        .describe("A film id from the provided catalog. Never invent one."),
      promptText: z
        .string()
        .describe(
          "A short, evocative question shown on the card, e.g. 'Does this match how today feels?'",
        ),
    }),
    execute: async ({ filmId, promptText }) => {
      const validated = validatePaletteFilmId(filmId);
      if (!validated.ok) {
        return { ok: false as const, error: validated.error };
      }
      return {
        ok: true as const,
        filmId: validated.filmId,
        promptText,
        displayed: true,
      };
    },
  }),
  finalizeExperience: tool({
    description:
      "Call exactly once, when you have enough signal (explicit film mentions plus palette reactions) to build a personalized experience. Calling this ends the conversation and starts the games.",
    inputSchema: z.object({
      selectedFilmIds: z
        .array(z.string())
        .describe(
          "3-6 film ids the user resonated with, including ones surfaced via palettes that they reacted well to.",
        ),
      moods: z
        .array(z.string())
        .describe("2-4 mood adjectives that describe the user right now."),
      crosswordWordIds: z
        .array(z.string())
        .describe(
          "10-14 crossword entry ids from the bank, weighted toward the selected films. Request at least 10 so that at least 8 words reliably interlock onto the grid (some ids always fail to place).",
        ),
      locationIds: z
        .array(z.string())
        .describe("4-6 location ids to feature in the NYC location quiz."),
    }),
    execute: async (input) => {
      const validated = validateExperienceProfile(input);
      if (!validated.ok) {
        return { ok: false as const, errors: validated.errors };
      }
      return { ok: true as const, profile: validated.profile };
    },
  }),
} as const;

export type OracleTools = typeof oracleTools;
export type OracleUIMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<OracleTools>
>;
