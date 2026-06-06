import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export const maxDuration = 15;

function scribeTokenError(message: string, status: number): Response {
  return Response.json({ error: message }, { status });
}

function formatScribeTokenFailure(error: unknown): { message: string; status: number } {
  const raw = error instanceof Error ? error.message : String(error);

  if (/missing_permissions|speech_to_text/i.test(raw)) {
    return {
      message:
        "ElevenLabs API key is missing Speech-to-Text permission. Enable “Speech to Text” on your key at elevenlabs.io/app/settings/api-keys, then restart the dev server.",
      status: 503,
    };
  }

  if (/401|unauthorized|invalid api key/i.test(raw)) {
    return {
      message:
        "ElevenLabs rejected the API key. Check ELEVENLABS_API_KEY in .env.local.",
      status: 503,
    };
  }

  return { message: raw || "Scribe token mint failed.", status: 500 };
}

/**
 * Guard seam for public deploy — rate-limit, origin check, or shared secret.
 * TODO: harden before public deploy — rate-limit / origin check / shared secret
 */
function requireScribeAccess(_req: Request): Response | null {
  return null;
}

export async function GET(req: Request) {
  const accessDenied = requireScribeAccess(req);
  if (accessDenied) return accessDenied;

  if (!process.env.ELEVENLABS_API_KEY) {
    return scribeTokenError("ELEVENLABS_API_KEY is not configured.", 503);
  }

  try {
    const elevenlabs = new ElevenLabsClient({
      apiKey: process.env.ELEVENLABS_API_KEY,
    });
    const { token } = await elevenlabs.tokens.singleUse.create("realtime_scribe");
    return Response.json({ token });
  } catch (error) {
    const { message, status } = formatScribeTokenFailure(error);
    if (process.env.NODE_ENV === "development") {
      console.error("[api/scribe-token]", error);
    }
    return scribeTokenError(message, status);
  }
}
