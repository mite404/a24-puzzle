import {
  getOraclePersona,
  resolvePersonaId,
  type OraclePersonaId,
} from "@/lib/oracle-personas";

export const maxDuration = 15;

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL_ID = process.env.OPENROUTER_MODEL ?? "moonshotai/kimi-k2.6";

function quipSystemPrompt(personaId: OraclePersonaId): string {
  const persona = getOraclePersona(personaId);
  return `You are ${persona.characterName} from ${persona.filmTitle}, hosting an A24 crossword puzzle in character.
The player has stalled on a clue. Tease them into action in one short sentence — witty, in voice, under 20 words.
Do NOT reveal, hint at, or spell any part of the answer. No quotes around the answer. One sentence only.`;
}

function sanitizeLine(text: string): string {
  return text.replace(/^["'\s]+|["'\s]+$/g, "").replace(/\s+/g, " ").trim();
}

/** OpenRouter chat/completions — reasoning.effort must be top-level (AI SDK providerOptions miss it for Kimi). */
async function generateQuipLine(
  personaId: OraclePersonaId,
  clueContext: string,
): Promise<string> {
  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL_ID,
      messages: [
        { role: "system", content: quipSystemPrompt(personaId) },
        { role: "user", content: `Clue they are stuck on: ${clueContext}` },
      ],
      max_tokens: 48,
      reasoning: { effort: "none" },
    }),
  });

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    throw new Error(payload?.error?.message ?? `OpenRouter failed (${res.status}).`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = data.choices?.[0]?.message?.content;
  return typeof content === "string" ? sanitizeLine(content) : "";
}

export async function POST(req: Request) {
  if (!process.env.OPENROUTER_API_KEY) {
    return Response.json(
      { error: "OPENROUTER_API_KEY is not configured." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = body as {
    personaId?: unknown;
    clue?: unknown;
    position?: unknown;
    orientation?: unknown;
  };

  const clue = typeof parsed.clue === "string" ? parsed.clue.trim() : "";
  if (!clue) {
    return Response.json({ error: "clue is required." }, { status: 400 });
  }

  const personaId = resolvePersonaId(parsed.personaId);
  const position =
    typeof parsed.position === "number" ? parsed.position : undefined;
  const orientation =
    parsed.orientation === "across" || parsed.orientation === "down"
      ? parsed.orientation
      : undefined;

  const clueContext = [
    position !== undefined ? `#${position}` : null,
    orientation ?? null,
    clue,
  ]
    .filter(Boolean)
    .join(" — ");

  try {
    const line = await generateQuipLine(personaId, clueContext);
    if (!line) {
      return Response.json({ error: "Empty model response." }, { status: 502 });
    }

    return Response.json({ line });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Quip generation failed.";
    if (process.env.NODE_ENV === "development") {
      console.warn("[api/oracle-quip]", message);
    }
    return Response.json({ error: message }, { status: 502 });
  }
}
