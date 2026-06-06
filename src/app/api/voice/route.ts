import {
  getOraclePersona,
  isOraclePersonaId,
  resolvePersonaId,
} from "@/lib/oracle-personas";

export const maxDuration = 30;

const TTS_MODEL = "eleven_turbo_v2_5";
const MAX_TTS_CHARS = 2500;

function voiceError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

export async function POST(req: Request) {
  if (!process.env.ELEVENLABS_API_KEY) {
    return voiceError("ELEVENLABS_API_KEY is not configured.", 503);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return voiceError("Invalid JSON body.", 400);
  }

  if (!body || typeof body !== "object") {
    return voiceError("Expected JSON object.", 400);
  }

  const { text, voiceId, personaId } = body as {
    text?: unknown;
    voiceId?: unknown;
    personaId?: unknown;
  };

  if (typeof text !== "string" || !text.trim()) {
    return voiceError('Expected non-empty "text" string.', 400);
  }

  const trimmed = text.trim().slice(0, MAX_TTS_CHARS);

  let resolvedVoiceId: string;
  if (typeof voiceId === "string" && voiceId.trim()) {
    resolvedVoiceId = voiceId.trim();
  } else if (isOraclePersonaId(personaId)) {
    resolvedVoiceId = getOraclePersona(personaId).elevenLabsVoiceId;
  } else {
    resolvedVoiceId = getOraclePersona(resolvePersonaId(personaId))
      .elevenLabsVoiceId;
  }

  try {
    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(resolvedVoiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: trimmed,
          model_id: TTS_MODEL,
        }),
      },
    );

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      if (process.env.NODE_ENV === "development") {
        console.error("[api/voice] ElevenLabs", upstream.status, detail);
      }
      const message =
        upstream.status === 401
          ? "ElevenLabs rejected the API key."
          : `ElevenLabs error (${upstream.status}).`;
      return voiceError(message, upstream.status === 401 ? 503 : 502);
    }

    if (!upstream.body) {
      return voiceError("ElevenLabs returned an empty body.", 502);
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Voice synthesis failed.";
    if (process.env.NODE_ENV === "development") {
      console.error("[api/voice]", error);
    }
    return voiceError(message, 500);
  }
}
