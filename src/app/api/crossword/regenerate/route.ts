import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { buildCatalog } from "@/lib/oracle-prompt";
import { validateExperienceProfile } from "@/lib/validate-experience";
import type { ExperienceProfile } from "@/lib/types";

export const maxDuration = 30;

const openrouter = createOpenAI({
  name: "openrouter",
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const MODEL_ID = process.env.OPENROUTER_MODEL ?? "moonshotai/kimi-k2.6";

const responseSchema = z.object({
  crosswordWordIds: z
    .array(z.string())
    .min(6)
    .max(10)
    .describe("Ids from the crossword catalog only."),
});

function buildRegeneratePrompt(
  profile: ExperienceProfile,
  excludeWordIds: string[],
): string {
  const films = profile.selectedFilmIds.join(", ");
  const moods = profile.moods.join(", ");
  const exclude =
    excludeWordIds.length > 0 ? excludeWordIds.join(", ") : "(none)";

  return [
    "You curate crossword entries for an A24 fan experience.",
    "The user already finished a conversation with the oracle. Pick a fresh set of crossword entry ids that reflect their films and moods.",
    "",
    `Selected films: ${films}`,
    `Moods: ${moods}`,
    `Do NOT reuse these ids unless the catalog is too small: ${exclude}`,
    "",
    "Rules:",
    "- Use only ids from CROSSWORD WORDS in the catalog below.",
    "- Weight toward selectedFilmIds; include variety in difficulty.",
    "- Return 6-10 ids.",
    "",
    buildCatalog(),
  ].join("\n");
}

export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      { error: "OPENROUTER_API_KEY is not configured." },
      { status: 503 },
    );
  }

  let profile: ExperienceProfile;
  let excludeWordIds: string[] = [];

  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== "object" || !("profile" in body)) {
      return Response.json({ error: "Expected { profile, excludeWordIds? }." }, { status: 400 });
    }
    const parsed = body as {
      profile: ExperienceProfile;
      excludeWordIds?: unknown;
    };
    profile = parsed.profile;
    if (Array.isArray(parsed.excludeWordIds)) {
      excludeWordIds = parsed.excludeWordIds.filter((id) => typeof id === "string");
    }
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const baseValid = validateExperienceProfile(profile);
  if (!baseValid.ok) {
    return Response.json({ error: baseValid.errors.join("; ") }, { status: 400 });
  }

  try {
    const { object } = await generateObject({
      model: openrouter.chat(MODEL_ID),
      schema: responseSchema,
      prompt: buildRegeneratePrompt(profile, excludeWordIds),
    });

    const nextProfile: ExperienceProfile = {
      ...profile,
      crosswordWordIds: object.crosswordWordIds,
    };
    const validated = validateExperienceProfile(nextProfile);
    if (!validated.ok) {
      return Response.json(
        { error: `Model returned invalid ids: ${validated.errors.join("; ")}` },
        { status: 422 },
      );
    }

    return Response.json({ crosswordWordIds: validated.profile.crosswordWordIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Regenerate failed.";
    return Response.json({ error: message }, { status: 502 });
  }
}
