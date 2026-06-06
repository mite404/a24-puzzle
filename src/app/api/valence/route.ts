import { analyzeDiscreteWav, type VocalEmotionResult } from "@/lib/valence";

export const maxDuration = 30;

async function readAudioBody(req: Request): Promise<Buffer | null> {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const entry = form.get("file") ?? form.get("audio");
    if (!entry || typeof entry === "string") return null;
    return Buffer.from(await entry.arrayBuffer());
  }

  const body = await req.arrayBuffer();
  if (!body.byteLength) return null;
  return Buffer.from(body);
}

/**
 * POST /api/valence — server-side vocal emotion analysis (Discrete API).
 *
 * Accepts raw WAV (`Content-Type: audio/wav`) or multipart field `file` / `audio`.
 * Returns `{ emotion, confidence, predictions }` or `null` (fail-open text-only turn).
 */
export async function POST(req: Request): Promise<Response> {
  let audio: Buffer | null;
  try {
    audio = await readAudioBody(req);
  } catch {
    return Response.json(null satisfies VocalEmotionResult | null);
  }

  if (!audio?.length) {
    return Response.json(null satisfies VocalEmotionResult | null);
  }

  const result = await analyzeDiscreteWav(audio);
  return Response.json(result satisfies VocalEmotionResult | null);
}
