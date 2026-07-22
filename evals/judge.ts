/**
 * evals/judge.ts — stage 3 of the blind eval harness (see specs/eval-harness.md).
 *
 * Scores each blinded puzzle in evals/blind/ against the fixed checklist in RUBRIC.md,
 * one puzzle at a time, and writes one JSON verdict per puzzle to evals/scores/.
 *
 * The scoring is ABSOLUTE, never pairwise: the judge sees a single blinded record — the
 * transcript, the placed words, the numbered clues, and the ASCII grid — plus the rubric,
 * and returns five binary checks (c1..c5) with a one-line rationale each. It never sees a
 * sibling puzzle, the persona, the arm, or the run index, because blind.ts already stripped
 * all of that behind a salted hash. key.json is deliberately NOT read here.
 *
 * The judge model is the `claude` CLI in print mode (`claude -p`), which is covered by the
 * user's subscription rather than OpenRouter — so, unlike run.ts, this stage spends no paid
 * API budget. The sweep is resumable: a puzzle whose scores/<blindId>.json already exists
 * and parses is skipped, so an interrupted judging pass never re-scores the same puzzle.
 *
 * Pure helpers (prompt building, JSON extraction, verdict parsing) are exported for unit
 * tests; the CLI invocation and the filesystem work run only under `import.meta.main`, so
 * importing this module in a test shells out to nothing and scores nothing.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import type { BlindClue, BlindRecord } from "./blind";
import type { TranscriptEntry } from "./run";

// --- Directories -----------------------------------------------------------

const EVALS_DIR = import.meta.dir;
const BLIND_DIR = join(EVALS_DIR, "blind");
const SCORES_DIR = join(EVALS_DIR, "scores");
const RUBRIC_FILE = join(EVALS_DIR, "RUBRIC.md");

/** The five rubric checks, in order. The judge must return a verdict for each. */
export const CHECK_IDS = ["c1", "c2", "c3", "c4", "c5"] as const;
export type CheckId = (typeof CHECK_IDS)[number];

// --- Judge verdict ---------------------------------------------------------

/** One check's verdict: the binary pass plus a one-line rationale for human audit. */
export interface CheckVerdict {
  pass: boolean;
  why: string;
}

/** The full verdict for one blinded puzzle — the five binary checks, keyed by id. */
export interface JudgeResult {
  blindId: string;
  c1: CheckVerdict;
  c2: CheckVerdict;
  c3: CheckVerdict;
  c4: CheckVerdict;
  c5: CheckVerdict;
}

// --- Prompt building (pure) ------------------------------------------------

/** Render the scripted conversation the judge reads, one labelled line per turn. */
function renderTranscript(transcript: TranscriptEntry[]): string {
  if (transcript.length === 0) return "(the conversation is empty)";
  return transcript
    .map((t) => `${t.role === "user" ? "USER" : "ORACLE"}: ${t.text}`)
    .join("\n");
}

/** Render the numbered clue list exactly as a solver would read it — no ids, no tags. */
function renderClues(clues: BlindClue[]): string {
  if (clues.length === 0) return "(no clues — the run produced no puzzle)";
  return clues
    .map((c) => `${c.number}. ${c.orientation}  ${c.answer} — ${c.clue}`)
    .join("\n");
}

/**
 * Build the full judging prompt for one blinded puzzle. Pure: same (record, rubric) ->
 * same prompt. The rubric is inlined verbatim so the bar the judge is held to is the exact
 * file under version control, and the puzzle is presented as the four things RUBRIC.md says
 * the judge may see and nothing else. The closing instruction pins the output to a single
 * JSON object so `parseJudgeResponse` can consume it.
 */
export function buildJudgePrompt(record: BlindRecord, rubric: string): string {
  return [
    "You are an impartial judge scoring ONE crossword puzzle generated from a scripted",
    "conversation between a user and a film oracle. Score it ABSOLUTELY, on its own terms —",
    "you are not comparing it to any other puzzle. Apply the rubric below exactly as written.",
    "",
    "=== RUBRIC ===",
    rubric.trim(),
    "",
    "=== THE PUZZLE TO SCORE ===",
    "",
    "-- Transcript --",
    renderTranscript(record.transcript),
    "",
    "-- Placed words --",
    record.words.length > 0 ? record.words.join(", ") : "(none)",
    "",
    "-- Clues --",
    renderClues(record.clues),
    "",
    "-- Grid --",
    record.grid,
    "",
    "=== YOUR ANSWER ===",
    "",
    "Return ONLY a single JSON object, no markdown fence and no prose around it, in exactly",
    "this shape (each check is a boolean `pass` plus a one-line `why`):",
    "",
    "{",
    `  "blindId": ${JSON.stringify(record.blindId)},`,
    '  "c1": { "pass": true, "why": "..." },',
    '  "c2": { "pass": true, "why": "..." },',
    '  "c3": { "pass": true, "why": "..." },',
    '  "c4": { "pass": true, "why": "..." },',
    '  "c5": { "pass": true, "why": "..." }',
    "}",
    "",
    "If a check cannot be evaluated (for example the puzzle is empty), mark it false and say",
    "so in `why` — absence of evidence is not a pass. Never omit a check.",
  ].join("\n");
}

// --- Response parsing (pure) -----------------------------------------------

/**
 * Pull the JSON object out of a judge response. The model may wrap it in a ```json fence
 * or add stray prose despite the instruction, so we take the fenced block if present and
 * otherwise the outermost `{ ... }` span. Throws when there is no object at all, so a
 * garbled response fails loudly rather than being silently scored as all-false.
 */
export function extractJson(raw: string): string {
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  const candidate = fence ? fence[1] : raw;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("judge response contained no JSON object");
  }
  return candidate.slice(start, end + 1);
}

/** Coerce one check field into a verdict, requiring a real boolean for `pass`. */
function asVerdict(value: unknown, check: CheckId): CheckVerdict {
  if (!value || typeof value !== "object") {
    throw new Error(`judge verdict for ${check} is missing or not an object`);
  }
  const rec = value as Record<string, unknown>;
  if (typeof rec.pass !== "boolean") {
    throw new Error(`judge verdict for ${check} has no boolean "pass"`);
  }
  const why = typeof rec.why === "string" ? rec.why : "(no rationale given)";
  return { pass: rec.pass, why };
}

/**
 * Parse a judge response into a validated JudgeResult. The `blindId` is taken from the
 * caller (the id we handed the judge), never from the model's echo — the judge only ever
 * knows one puzzle's id, so trusting our own value keeps a stray echo from mislabelling a
 * score. Throws if any of the five checks is absent or malformed.
 */
export function parseJudgeResponse(raw: string, blindId: string): JudgeResult {
  const parsed = JSON.parse(extractJson(raw)) as Record<string, unknown>;
  return {
    blindId,
    c1: asVerdict(parsed.c1, "c1"),
    c2: asVerdict(parsed.c2, "c2"),
    c3: asVerdict(parsed.c3, "c3"),
    c4: asVerdict(parsed.c4, "c4"),
    c5: asVerdict(parsed.c5, "c5"),
  };
}

// --- Scoring one record ----------------------------------------------------

/** A judge backend: prompt in, raw model text out. The CLI impl lives below the fold. */
export type JudgeFn = (prompt: string) => Promise<string>;

/**
 * Score one blinded record. The judge backend is injected so tests can feed canned
 * responses without shelling out to `claude`; the CLI implementation is the default only
 * from `main`.
 */
export async function scoreBlindRecord(
  record: BlindRecord,
  rubric: string,
  judge: JudgeFn,
): Promise<JudgeResult> {
  const prompt = buildJudgePrompt(record, rubric);
  const raw = await judge(prompt);
  return parseJudgeResponse(raw, record.blindId);
}

// --- Filesystem (impure; only reached from the CLI) ------------------------

/** A blinded file paired with its parsed record, so failures name the offending file. */
interface LoadedBlind {
  fileName: string;
  record: BlindRecord;
}

/**
 * Read every blinded record in `blindDir`, sorted for stable order. `key.json` is skipped
 * explicitly — it is the unblinding key and the judge must never read it.
 */
export function loadBlindRecords(blindDir: string): LoadedBlind[] {
  if (!existsSync(blindDir)) return [];
  return readdirSync(blindDir)
    .filter((f) => f.endsWith(".json") && f !== "key.json")
    .sort()
    .map((fileName) => {
      const raw = readFileSync(join(blindDir, fileName), "utf8");
      const record = JSON.parse(raw) as BlindRecord;
      return { fileName, record };
    });
}

/** True if a puzzle already has a parseable score file — the resumability check. */
export function scoreIsDone(scoresDir: string, blindId: string): boolean {
  const path = join(scoresDir, `${blindId}.json`);
  if (!existsSync(path)) return false;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return Boolean(parsed && typeof parsed === "object");
  } catch {
    return false;
  }
}

/**
 * Build the error message for a non-zero `claude -p` exit. Prefers stderr, then falls
 * back to stdout, then to a marker. The fallback to stdout matters: some CLI failures
 * (notably "Not logged in · Please run /login") are printed to STDOUT, so an stderr-only
 * message would report "(no stderr)" and hide the real cause — which is exactly what the
 * first smoke sweep hit.
 */
export function describeClaudeFailure(
  code: number,
  stdout: string,
  stderr: string,
): string {
  const detail = stderr.trim() || stdout.trim() || "(no output)";
  return `claude -p exited ${code}: ${detail}`;
}

/**
 * The default judge backend: the `claude` CLI in print mode. The prompt goes in on stdin
 * (not as an argv, which would blow the length limit on a full rubric + transcript), and
 * the model's text comes back on stdout. A non-zero exit is surfaced as a throw so the cell
 * is left unscored and can be retried, rather than being written as a bogus all-false score.
 */
function claudeJudge(prompt: string): Promise<string> {
  return (async () => {
    const proc = Bun.spawn(["claude", "-p"], {
      stdin: Buffer.from(prompt, "utf8"),
      stdout: "pipe",
      stderr: "pipe",
    });
    const [out, err, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    if (code !== 0) {
      throw new Error(describeClaudeFailure(code, out, err));
    }
    return out;
  })();
}

// --- CLI -------------------------------------------------------------------

interface CliOptions {
  only: string[] | null;
  limit: number | null;
}

function parseCliArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { only: null, limit: null };
  for (const arg of argv) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (key === "only" && value) {
      opts.only = value.split(",").map((s) => s.trim()).filter(Boolean);
    } else if (key === "limit" && value) {
      const n = Number.parseInt(value, 10);
      if (Number.isFinite(n) && n > 0) opts.limit = n;
    }
  }
  return opts;
}

async function main(): Promise<void> {
  const opts = parseCliArgs(process.argv.slice(2));

  if (!existsSync(RUBRIC_FILE)) {
    console.error(`No rubric at ${RUBRIC_FILE}.`);
    process.exit(1);
  }
  const rubric = readFileSync(RUBRIC_FILE, "utf8");

  let blinded = loadBlindRecords(BLIND_DIR);
  if (blinded.length === 0) {
    console.error(`No blinded records in ${BLIND_DIR}. Run evals/blind.ts first.`);
    process.exit(1);
  }
  if (opts.only) {
    const wanted = new Set(opts.only);
    blinded = blinded.filter((b) => wanted.has(b.record.blindId));
  }
  if (opts.limit !== null) {
    blinded = blinded.slice(0, opts.limit);
  }
  if (blinded.length === 0) {
    console.error("No blinded records matched. Check --only / --limit.");
    process.exit(1);
  }

  mkdirSync(SCORES_DIR, { recursive: true });

  console.log(`Judging ${blinded.length} puzzle(s) with \`claude -p\` ...`);
  let scored = 0;
  let skipped = 0;
  let failed = 0;
  for (const { record } of blinded) {
    const { blindId } = record;
    if (scoreIsDone(SCORES_DIR, blindId)) {
      skipped += 1;
      console.log(`  skip  ${blindId} (already scored)`);
      continue;
    }

    console.log(`  judge ${blindId} ...`);
    try {
      const result = await scoreBlindRecord(record, rubric, claudeJudge);
      writeFileSync(
        join(SCORES_DIR, `${blindId}.json`),
        JSON.stringify(result, null, 2) + "\n",
      );
      scored += 1;
      const line = CHECK_IDS.map(
        (c) => `${c}:${result[c].pass ? "PASS" : "FAIL"}`,
      ).join(" ");
      console.log(`        ${line}`);
    } catch (error) {
      failed += 1;
      console.log(
        `        ERROR: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.log(
    `Done. ${scored} scored, ${skipped} skipped, ${failed} failed. Scores -> ${SCORES_DIR}`,
  );
  if (failed > 0) process.exit(1);
}

if (import.meta.main) {
  await main();
}
