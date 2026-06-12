import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import {
  ValenceClient,
  AudioTooShortError,
  AudioTooLongError,
} from "valenceai";

/** Verified 2026-06-06 via scripts/valence-spike.ts — AUDIO_TOO_SHORT (400). */
const VALENCE_MIN_CLIP_SECONDS = 4.5;

/** Verified 2026-06-06 via scripts/valence-spike.ts — AUDIO_TOO_LONG (400). */
const VALENCE_MAX_CLIP_SECONDS = 15;

/**
 * Valence docs recommend dropping weak predictions client-side.
 * Not API-enforced — verified 2026-06-06 (API returns all scores regardless).
 */
const VALENCE_CONFIDENCE_GATE = 0.38;

const VALENCE_DEFAULT_EMOTIONS = [
  "angry",
  "happy",
  "neutral",
  "sad",
] as const;

const VALENCE_EXTENDED_EMOTIONS = [
  "surprised",
  "disgusted",
  "nervous",
  "irritated",
  "excited",
  "sleepy",
] as const;

export interface VocalEmotionResult {
  emotion: string;
  confidence: number;
  predictions: Record<string, number>;
}

interface WavPcm {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  samples: Int16Array;
}

interface ValenceDiscreteResponse {
  main_emotion?: string;
  confidence?: number;
  all_predictions?: Record<string, number>;
}

function isWav(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WAVE"
  );
}

/** Parse standard PCM WAV into mono Int16 samples. */
function parseWavPcm(buffer: Buffer): WavPcm | null {
  if (!isWav(buffer)) return null;

  let offset = 12;
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataSize = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;

    if (chunkId === "fmt ") {
      audioFormat = buffer.readUInt16LE(chunkDataStart);
      channels = buffer.readUInt16LE(chunkDataStart + 2);
      sampleRate = buffer.readUInt32LE(chunkDataStart + 4);
      bitsPerSample = buffer.readUInt16LE(chunkDataStart + 14);
    } else if (chunkId === "data") {
      dataOffset = chunkDataStart;
      dataSize = chunkSize;
      break;
    }

    offset = chunkDataStart + chunkSize + (chunkSize % 2);
  }

  if (
    dataOffset < 0 ||
    audioFormat !== 1 ||
    bitsPerSample !== 16 ||
    channels < 1 ||
    sampleRate < 8_000
  ) {
    return null;
  }

  const frameCount = Math.floor(dataSize / (channels * 2));
  const samples = new Int16Array(frameCount);

  for (let i = 0; i < frameCount; i++) {
    if (channels === 1) {
      samples[i] = buffer.readInt16LE(dataOffset + i * 2);
    } else {
      let sum = 0;
      for (let ch = 0; ch < channels; ch++) {
        sum += buffer.readInt16LE(dataOffset + (i * channels + ch) * 2);
      }
      samples[i] = Math.round(sum / channels);
    }
  }

  return { sampleRate, channels: 1, bitsPerSample: 16, samples };
}

function encodeMonoWav(pcm: WavPcm): Buffer {
  const dataSize = pcm.samples.length * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(pcm.sampleRate, 24);
  buffer.writeUInt32LE(pcm.sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < pcm.samples.length; i++) {
    buffer.writeInt16LE(pcm.samples[i] ?? 0, 44 + i * 2);
  }

  return buffer;
}

export function wavDurationSeconds(buffer: Buffer): number | null {
  const pcm = parseWavPcm(buffer);
  if (!pcm) return null;
  return pcm.samples.length / pcm.sampleRate;
}

/** Keep the most recent `maxSeconds` of audio (tone at end of utterance). */
function trimWavKeepLastSeconds(
  buffer: Buffer,
  maxSeconds: number,
): Buffer {
  const pcm = parseWavPcm(buffer);
  if (!pcm) return buffer;

  const maxSamples = Math.floor(maxSeconds * pcm.sampleRate);
  if (pcm.samples.length <= maxSamples) return buffer;

  return encodeMonoWav({
    ...pcm,
    samples: pcm.samples.slice(pcm.samples.length - maxSamples),
  });
}

function mapValenceResponse(data: ValenceDiscreteResponse): VocalEmotionResult | null {
  const emotion = data.main_emotion;
  const confidence = data.confidence;
  const predictions = data.all_predictions;

  if (
    typeof emotion !== "string" ||
    typeof confidence !== "number" ||
    !predictions ||
    typeof predictions !== "object"
  ) {
    return null;
  }

  if (confidence < VALENCE_CONFIDENCE_GATE) {
    return null;
  }

  return { emotion, confidence, predictions };
}

/**
 * Analyze mono PCM WAV via Valence Discrete API.
 * Fail-open: returns null on short clips, low confidence, or any error.
 */
export async function analyzeDiscreteWav(
  input: Buffer,
  options?: { apiKey?: string },
): Promise<VocalEmotionResult | null> {
  const apiKey = options?.apiKey ?? process.env.VALENCE_API_KEY;
  if (!apiKey) return null;

  if (!isWav(input)) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[valence] Non-WAV input — skipping (client sends mono PCM WAV via manual Scribe tap)");
    }
    return null;
  }

  const duration = wavDurationSeconds(input);
  if (duration === null) return null;
  if (duration < VALENCE_MIN_CLIP_SECONDS) return null;

  const wav =
    duration > VALENCE_MAX_CLIP_SECONDS
      ? trimWavKeepLastSeconds(input, VALENCE_MAX_CLIP_SECONDS)
      : input;

  const dir = mkdtempSync(join(tmpdir(), "valence-"));
  const filePath = join(dir, `${randomBytes(8).toString("hex")}.wav`);

  try {
    writeFileSync(filePath, wav);
    const client = new ValenceClient({ apiKey });
    const raw = (await client.discrete.emotions(
      filePath,
      null,
      "4emotions",
    )) as ValenceDiscreteResponse;
    return mapValenceResponse(raw);
  } catch (error) {
    if (
      error instanceof AudioTooShortError ||
      error instanceof AudioTooLongError
    ) {
      return null;
    }
    if (process.env.NODE_ENV === "development") {
      console.error("[valence] Discrete analysis failed:", error);
    }
    return null;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
