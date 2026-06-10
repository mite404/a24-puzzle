import { pickQuip } from "@/lib/crossword-oracle-quips";

/** Pick idle45 line: LLM zinger when present, otherwise authored bank. */
export function resolveIdle45Line(
  llmLine: string | null | undefined,
  bank: string[],
  lastSpoken?: string,
): string {
  const trimmed = llmLine?.trim();
  if (trimmed) return trimmed;
  return pickQuip(bank, lastSpoken);
}

export async function fetchOracleQuipLine(
  personaId: string,
  word: { clue: string; position: number; orientation: string },
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    const res = await fetchImpl("/api/oracle-quip", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personaId,
        clue: word.clue,
        position: word.position,
        orientation: word.orientation,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = (await res.json()) as { line?: string };
    const line = data.line?.trim();
    return line || null;
  } catch {
    return null;
  }
}
