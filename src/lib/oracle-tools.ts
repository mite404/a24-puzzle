import { z } from "zod";
import {
  tool,
  type InferUITools,
  type UIDataTypes,
  type UIMessage,
} from "ai";

/**
 * Tools the oracle uses mid-conversation. Neither has an `execute` function:
 * they are resolved on the client (render a palette card / transition phase).
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
          "6-10 crossword entry ids from the bank, weighted toward the selected films.",
        ),
      locationIds: z
        .array(z.string())
        .describe("4-6 location ids to feature in the NYC location quiz."),
    }),
  }),
} as const;

export type OracleTools = typeof oracleTools;
export type OracleUIMessage = UIMessage<
  never,
  UIDataTypes,
  InferUITools<OracleTools>
>;
