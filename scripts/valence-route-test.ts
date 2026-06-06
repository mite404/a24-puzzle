/**
 * Phase 2 route smoke test — run: bun scripts/valence-route-test.ts
 * Optionally hits dev server if running: bun run dev
 */

import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { analyzeDiscreteWav, wavDurationSeconds } from "../src/lib/valence";

const SAMPLE_RATE = 44_100;
const TMP = join(dirname(fileURLToPath(import.meta.url)), ".valence-route-test");

function writeMonoWav(filePath: string, durationSeconds: number): Buffer {
  const numSamples = Math.floor(durationSeconds * SAMPLE_RATE);
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const sample = Math.floor(
      32_767 * 0.25 * Math.sin(2 * Math.PI * 220 * t),
    );
    buffer.writeInt16LE(sample, 44 + i * 2);
  }

  writeFileSync(filePath, buffer);
  return buffer;
}

// Load .env.local
const envLocal = await Bun.file(".env.local").text().catch(() => "");
for (const line of envLocal.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eq = trimmed.indexOf("=");
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const value = trimmed.slice(eq + 1).trim();
  if (!process.env[key]) process.env[key] = value;
}

mkdirSync(TMP, { recursive: true });
const wav6 = writeMonoWav(join(TMP, "6s.wav"), 6);
const wav3 = writeMonoWav(join(TMP, "3s.wav"), 3);

console.log("--- lib: 6 s clip ---");
console.log("duration:", wavDurationSeconds(wav6), "s");
console.log(JSON.stringify(await analyzeDiscreteWav(wav6), null, 2));

console.log("\n--- lib: 3 s clip (expect null) ---");
console.log("duration:", wavDurationSeconds(wav3), "s");
console.log(JSON.stringify(await analyzeDiscreteWav(wav3), null, 2));

const base = process.env.VALENCE_TEST_URL ?? "http://localhost:3000";

async function curlRoute(label: string, wav: Buffer) {
  try {
    const res = await fetch(`${base}/api/valence`, {
      method: "POST",
      headers: { "Content-Type": "audio/wav" },
      body: wav,
    });
    const json = await res.json();
    console.log(`\n--- route ${label} (${res.status}) ---`);
    console.log(JSON.stringify(json, null, 2));
  } catch (err) {
    console.log(`\n--- route ${label}: dev server not reachable (${base}) ---`);
    console.log(String(err));
  }
}

await curlRoute("6s", wav6);
await curlRoute("3s", wav3);

rmSync(TMP, { recursive: true, force: true });
