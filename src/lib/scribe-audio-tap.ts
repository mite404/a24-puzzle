"use client";

import { loadScribeAudioProcessor } from "@/lib/scribe-audio-worklet";
import type { VocalEmotionResult } from "@/lib/valence";

const TARGET_SAMPLE_RATE = 16_000;

export interface ScribeMicConstraints {
  echoCancellation?: boolean;
  noiseSuppression?: boolean;
  autoGainControl?: boolean;
}

export interface ScribeAudioTap {
  stop: () => Promise<Blob | null>;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i] ?? 0);
  }
  return btoa(binary);
}

function mergeArrayBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
  const total = buffers.reduce((sum, buf) => sum + buf.byteLength, 0);
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const buf of buffers) {
    merged.set(new Uint8Array(buf), offset);
    offset += buf.byteLength;
  }
  return merged.buffer;
}

/** Encode mono PCM16 LE samples into a WAV container. */
export function encodePcm16ToWav(pcm: ArrayBuffer, sampleRate: number): ArrayBuffer {
  const dataSize = pcm.byteLength;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, "data");
  view.setUint32(40, dataSize, true);

  new Uint8Array(buffer, 44).set(new Uint8Array(pcm));
  return buffer;
}

/**
 * Single mic tap: ElevenLabs Scribe worklet → base64 PCM chunks, plus local
 * PCM accumulation for Valence WAV export on stop.
 */
export async function startScribeAudioTap(
  onPcmChunkBase64: (base64: string) => void,
  mic: ScribeMicConstraints = {},
): Promise<ScribeAudioTap> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: mic.echoCancellation ?? true,
      noiseSuppression: mic.noiseSuppression ?? true,
      autoGainControl: mic.autoGainControl ?? true,
      channelCount: 1,
      sampleRate: { ideal: TARGET_SAMPLE_RATE },
    },
  });

  const [audioTrack] = stream.getAudioTracks();
  const streamSampleRate = audioTrack?.getSettings().sampleRate;
  const audioContext = new AudioContext(
    streamSampleRate ? { sampleRate: streamSampleRate } : {},
  );

  const pcmChunks: ArrayBuffer[] = [];
  let stopped = false;

  await loadScribeAudioProcessor(audioContext.audioWorklet);

  const source = audioContext.createMediaStreamSource(stream);
  const scribeNode = new AudioWorkletNode(audioContext, "scribeAudioProcessor");

  if (audioContext.sampleRate !== TARGET_SAMPLE_RATE) {
    scribeNode.port.postMessage({
      type: "configure",
      inputSampleRate: audioContext.sampleRate,
      outputSampleRate: TARGET_SAMPLE_RATE,
    });
  }

  scribeNode.port.onmessage = (event: MessageEvent<{ audioData?: ArrayBuffer }>) => {
    if (stopped || !event.data?.audioData) return;
    const copy = event.data.audioData.slice(0);
    pcmChunks.push(copy);
    onPcmChunkBase64(arrayBufferToBase64(copy));
  };

  source.connect(scribeNode);

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  return {
    stop: async () => {
      if (stopped) return null;
      stopped = true;

      scribeNode.port.onmessage = null;
      for (const track of stream.getTracks()) {
        track.stop();
      }
      source.disconnect();
      scribeNode.disconnect();
      await audioContext.close();

      if (pcmChunks.length === 0) return null;

      const pcm = mergeArrayBuffers(pcmChunks);
      const wav = encodePcm16ToWav(pcm, TARGET_SAMPLE_RATE);
      return new Blob([wav], { type: "audio/wav" });
    },
  };
}

/** Fail-open Valence analyze with wall-clock cap so submit never blocks long. */
export const VALENCE_SUBMIT_TIMEOUT_MS = 2500;

function estimateWavDurationSec(blob: Blob): number {
  return Math.max(0, (blob.size - 44) / 2 / TARGET_SAMPLE_RATE);
}

function logValenceDev(message: string): void {
  if (process.env.NODE_ENV === "development") {
    console.info(`[oracle-scribe] valence: ${message}`);
  }
}

export async function resolveVocalEmotion(
  wavBlob: Blob | null,
  timeoutMs = VALENCE_SUBMIT_TIMEOUT_MS,
): Promise<VocalEmotionResult | null> {
  if (!wavBlob?.size) {
    logValenceDev("skipped — no audio captured");
    return null;
  }

  const clipSec = estimateWavDurationSec(wavBlob);
  const clipLabel = `${clipSec.toFixed(1)}s clip`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = performance.now();

  try {
    const res = await fetch("/api/valence", {
      method: "POST",
      headers: { "Content-Type": "audio/wav" },
      body: wavBlob,
      signal: controller.signal,
    });
    const payload = (await res.json()) as VocalEmotionResult | null;
    const elapsed = Math.round(performance.now() - started);

    if (
      payload &&
      typeof payload.emotion === "string" &&
      typeof payload.confidence === "number"
    ) {
      logValenceDev(
        `${payload.emotion} (${payload.confidence.toFixed(2)}) — ${clipLabel}, ${elapsed}ms`,
      );
      return payload;
    }

    if (payload === null) {
      logValenceDev(
        `no signal — ${clipLabel}, ${elapsed}ms (too short, low confidence, or API skip)`,
      );
    } else {
      logValenceDev(`unexpected response — ${clipLabel}, ${elapsed}ms`);
    }
    return null;
  } catch (error) {
    const elapsed = Math.round(performance.now() - started);
    const reason =
      error instanceof DOMException && error.name === "AbortError"
        ? `timeout after ${timeoutMs}ms`
        : "network error";
    logValenceDev(`failed — ${clipLabel}, ${reason}, ${elapsed}ms`);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
