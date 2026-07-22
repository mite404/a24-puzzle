/**
 * evals/run.ts — stage 1 of the blind eval harness (see specs/eval-harness.md).
 *
 * Drives a scripted conversation between:
 *   - the ORACLE under test: the real `buildSystemPrompt()` + real `oracleTools`,
 *     against OPENROUTER_MODEL — exactly the system the app ships.
 *   - a scripted USER: a second model role-playing a persona sheet from evals/personas/.
 *
 * The run ends when the oracle calls `finalizeExperience`, or when the persona's
 * `turn_cap` trips (itself a failure). One JSON record per (persona, arm, run) lands
 * in evals/runs/. The sweep is resumable: a cell whose output file already exists and
 * parses is skipped, so an interrupted sweep never pays OpenRouter twice.
 *
 * This file exposes pure helpers (persona parsing, the conversation state machine) so
 * they can be unit-tested without spending API budget; the model wiring lives behind
 * factory functions and the CLI runs only under `import.meta.main`.
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  generateText,
  stepCountIs,
  type LanguageModel,
  type ModelMessage,
} from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { oracleTools } from "@/lib/oracle-tools";
import { buildSystemPrompt } from "@/lib/oracle-prompt";
import { buildGamePayload } from "@/lib/game";
import type {
  CrosswordEntry,
  CrosswordLayout,
  ExperienceProfile,
  FilmId,
} from "@/lib/types";

// --- Directories -----------------------------------------------------------

const EVALS_DIR = import.meta.dir;
const PERSONAS_DIR = join(EVALS_DIR, "personas");
const RUNS_DIR = join(EVALS_DIR, "runs");

// --- Persona sheets --------------------------------------------------------

/** A parsed persona sheet: the YAML frontmatter fields plus the Markdown body. */
export interface PersonaSheet {
  id: string;
  axis: string;
  anchorFilms: string[];
  offcatalogMentions: string[];
  style: string;
  turnCap: number;
  expectsFinalize: boolean;
  /** Verbatim first user turn, from the "## Opening message" section. */
  openingMessage: string;
  /** The full Markdown body — fed verbatim as the scripted-user system prompt. */
  body: string;
}

interface Frontmatter {
  front: string;
  body: string;
}

function splitFrontmatter(raw: string): Frontmatter {
  const match = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  if (!match) {
    throw new Error("persona sheet is missing its YAML frontmatter block");
  }
  return { front: match[1], body: match[2] };
}

function stripQuotes(value: string): string {
  return value.replace(/^["']|["']$/g, "");
}

/** Minimal YAML: `key: scalar` or `key: [a, b, c]`. No nesting is used in sheets. */
function parseFront(front: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const line of front.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf(":");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      const inner = value.slice(1, -1).trim();
      out[key] = inner
        ? inner.split(",").map((s) => stripQuotes(s.trim())).filter(Boolean)
        : [];
    } else {
      out[key] = stripQuotes(value);
    }
  }
  return out;
}

function asString(
  data: Record<string, string | string[]>,
  key: string,
): string {
  const value = data[key];
  if (typeof value !== "string") {
    throw new Error(`frontmatter field "${key}" must be a string`);
  }
  return value;
}

function asArray(
  data: Record<string, string | string[]>,
  key: string,
): string[] {
  const value = data[key];
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

/** Pulls one `## <heading>` section body out of a Markdown document. */
export function extractSection(body: string, heading: string): string {
  const re = new RegExp(`^##\\s+${heading}\\s*$`, "im");
  const m = re.exec(body);
  if (!m) return "";
  const rest = body.slice(m.index + m[0].length);
  const nextIdx = rest.search(/^##\s+/m);
  const section = nextIdx === -1 ? rest : rest.slice(0, nextIdx);
  return section.trim();
}

/** Parse a persona sheet from its raw file contents. Pure — no filesystem. */
export function parsePersonaSheet(raw: string, fallbackId: string): PersonaSheet {
  const { front, body } = splitFrontmatter(raw);
  const data = parseFront(front);

  const id = typeof data.id === "string" && data.id ? data.id : fallbackId;
  const turnCapRaw = asString(data, "turn_cap");
  const turnCap = Number.parseInt(turnCapRaw, 10);
  if (!Number.isFinite(turnCap) || turnCap < 1) {
    throw new Error(`persona "${id}" has an invalid turn_cap: ${turnCapRaw}`);
  }

  const openingMessage = extractSection(body, "Opening message");
  if (!openingMessage) {
    throw new Error(`persona "${id}" has no "## Opening message" section`);
  }

  return {
    id,
    axis: asString(data, "axis"),
    anchorFilms: asArray(data, "anchor_films"),
    offcatalogMentions: asArray(data, "offcatalog_mentions"),
    style: asString(data, "style"),
    turnCap,
    expectsFinalize: asString(data, "expects_finalize") === "true",
    openingMessage,
    body,
  };
}

/** Names of the persona sheet files (excludes README.md), sorted for stable order. */
export function listPersonaFiles(dir: string = PERSONAS_DIR): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md") && f.toLowerCase() !== "readme.md")
    .sort();
}

/** Load and parse a single persona sheet from disk. */
export function loadPersonaSheet(filePath: string): PersonaSheet {
  const raw = readFileSync(filePath, "utf8");
  const fallbackId = filePath.replace(/^.*\//, "").replace(/\.md$/, "");
  return parsePersonaSheet(raw, fallbackId);
}

/** Load every persona sheet in `dir`. */
export function loadAllPersonas(dir: string = PERSONAS_DIR): PersonaSheet[] {
  return listPersonaFiles(dir).map((f) => loadPersonaSheet(join(dir, f)));
}

// --- Conversation state machine (pure) -------------------------------------

export interface TranscriptEntry {
  role: "user" | "oracle";
  text: string;
}

/** One advance of the oracle: its text plus whichever tool (if any) it invoked. */
export interface OracleStepResult {
  text: string;
  palette?: { filmId: string; promptText: string };
  finalize?: ExperienceProfile;
}

export type OracleStep = (userText: string) => Promise<OracleStepResult>;
export type UserStep = (oracleText: string) => Promise<string>;

export interface ConversationResult {
  transcript: TranscriptEntry[];
  finalized: boolean;
  reachedCap: boolean;
  userTurns: number;
  profile: ExperienceProfile | null;
}

/** Render an oracle step into the single string the transcript + user model see. */
export function renderOracleTurn(result: OracleStepResult): string {
  const parts: string[] = [];
  if (result.text.trim()) parts.push(result.text.trim());
  if (result.palette) {
    parts.push(
      `[shows a color palette from "${result.palette.filmId}" — ${result.palette.promptText}]`,
    );
  }
  return parts.join("\n") || "[the oracle said nothing]";
}

/**
 * Alternates oracle and scripted user until the oracle finalizes or the turn cap
 * trips. The persona's opening message is user turn 1 (verbatim from the sheet), so
 * the loop always starts by handing that to the oracle.
 */
export async function driveConversation(opts: {
  openingMessage: string;
  turnCap: number;
  oracleStep: OracleStep;
  userStep: UserStep;
}): Promise<ConversationResult> {
  const transcript: TranscriptEntry[] = [];
  let userText = opts.openingMessage;
  transcript.push({ role: "user", text: userText });
  let userTurns = 1;

  let finalized = false;
  let reachedCap = false;
  let profile: ExperienceProfile | null = null;

  for (;;) {
    const oracle = await opts.oracleStep(userText);
    transcript.push({ role: "oracle", text: renderOracleTurn(oracle) });

    if (oracle.finalize) {
      finalized = true;
      profile = oracle.finalize;
      break;
    }
    if (userTurns >= opts.turnCap) {
      reachedCap = true;
      break;
    }

    userText = await opts.userStep(renderOracleTurn(oracle));
    transcript.push({ role: "user", text: userText });
    userTurns += 1;
  }

  return { transcript, finalized, reachedCap, userTurns, profile };
}

// --- Model wiring (impure; only reached from the CLI) ----------------------

interface FinalizeInput {
  selectedFilmIds: string[];
  moods: string[];
  crosswordWordIds: string[];
  locationIds: string[];
}

interface PaletteInput {
  filmId: string;
  promptText: string;
}

/**
 * Oracle step backed by the real prompt + tools. Closes over the running message
 * history so each call is one `stepCountIs(1)` step — the same one-step-per-turn
 * cadence as the production /api/chat route.
 */
function makeOracleStep(model: LanguageModel, systemPrompt: string): OracleStep {
  const messages: ModelMessage[] = [];
  return async (userText) => {
    messages.push({ role: "user", content: userText });
    const result = await generateText({
      model,
      system: systemPrompt,
      messages,
      tools: oracleTools,
      stopWhen: stepCountIs(1),
    });
    messages.push(...result.response.messages);

    let palette: OracleStepResult["palette"];
    let finalize: OracleStepResult["finalize"];
    for (const call of result.toolCalls) {
      if (call.toolName === "finalizeExperience") {
        const input = call.input as unknown as FinalizeInput;
        finalize = {
          selectedFilmIds: input.selectedFilmIds as FilmId[],
          moods: input.moods,
          crosswordWordIds: input.crosswordWordIds,
          locationIds: input.locationIds,
        };
      } else if (call.toolName === "showPalette") {
        const input = call.input as unknown as PaletteInput;
        palette = { filmId: input.filmId, promptText: input.promptText };
      }
    }
    return { text: result.text, palette, finalize };
  };
}

const USER_DRIVER_PREAMBLE = [
  "You are role-playing a synthetic user talking to an AI film oracle that recommends",
  "A24 films and then builds a puzzle from the conversation. Stay fully in character as",
  "the persona described below. Reply ONLY with what this user would say next — no",
  "narration, no stage directions, no meta commentary, no markdown. Obey the persona's",
  "length and register rules exactly. Never break character, never mention that you are",
  "an AI or that this is an evaluation, and never invent film facts you are unsure of.",
  "",
  "--- PERSONA SHEET ---",
  "",
].join("\n");

/**
 * Scripted-user step. The user model sees the dialogue from its own side: the oracle's
 * turns are `user` messages, the persona's own prior turns are `assistant` messages.
 * Seeded with the verbatim opening message so the model has continuity from turn 1.
 */
function makeUserStep(
  model: LanguageModel,
  persona: PersonaSheet,
): UserStep {
  const history: ModelMessage[] = [
    { role: "assistant", content: persona.openingMessage },
  ];
  const system = USER_DRIVER_PREAMBLE + persona.body;
  return async (oracleText) => {
    history.push({ role: "user", content: oracleText });
    const result = await generateText({ model, system, messages: history });
    const reply = result.text.trim() || "...";
    history.push({ role: "assistant", content: reply });
    return reply;
  };
}

// --- Run records + resumable sweep -----------------------------------------

export interface RunRecord {
  persona: string;
  axis: string;
  arm: string;
  runIndex: number;
  oracleModel: string;
  userModel: string;
  turnCap: number;
  expectsFinalize: boolean;
  anchorFilms: string[];
  offcatalogMentions: string[];
  finalized: boolean;
  reachedCap: boolean;
  userTurns: number;
  transcript: TranscriptEntry[];
  profile: ExperienceProfile | null;
  crossword: CrosswordLayout | null;
  crosswordWords: CrosswordEntry[];
  error: string | null;
  finishedAt: string;
}

export function runFileName(
  persona: string,
  arm: string,
  runIndex: number,
): string {
  return `${persona}__${arm}__run${runIndex}.json`;
}

/** True if a cell already has a parseable, non-empty output file. */
export function cellIsDone(runsDir: string, fileName: string): boolean {
  const path = join(runsDir, fileName);
  if (!existsSync(path)) return false;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return Boolean(parsed && typeof parsed === "object");
  } catch {
    return false;
  }
}

interface CellConfig {
  persona: PersonaSheet;
  arm: string;
  runIndex: number;
  oracleModel: LanguageModel;
  userModel: LanguageModel;
  oracleModelId: string;
  userModelId: string;
  finishedAt: string;
}

/** Execute one conversation cell and assemble its record (no filesystem writes). */
async function runCell(config: CellConfig): Promise<RunRecord> {
  const { persona } = config;
  const base: Omit<
    RunRecord,
    | "finalized"
    | "reachedCap"
    | "userTurns"
    | "transcript"
    | "profile"
    | "crossword"
    | "crosswordWords"
    | "error"
  > = {
    persona: persona.id,
    axis: persona.axis,
    arm: config.arm,
    runIndex: config.runIndex,
    oracleModel: config.oracleModelId,
    userModel: config.userModelId,
    turnCap: persona.turnCap,
    expectsFinalize: persona.expectsFinalize,
    anchorFilms: persona.anchorFilms,
    offcatalogMentions: persona.offcatalogMentions,
    finishedAt: config.finishedAt,
  };

  try {
    const conversation = await driveConversation({
      openingMessage: persona.openingMessage,
      turnCap: persona.turnCap,
      oracleStep: makeOracleStep(
        config.oracleModel,
        buildSystemPrompt(),
      ),
      userStep: makeUserStep(config.userModel, persona),
    });

    let crossword: CrosswordLayout | null = null;
    let crosswordWords: CrosswordEntry[] = [];
    if (conversation.profile) {
      const payload = buildGamePayload(conversation.profile);
      crossword = payload.crossword;
      crosswordWords = payload.crosswordWords;
    }

    return {
      ...base,
      finalized: conversation.finalized,
      reachedCap: conversation.reachedCap,
      userTurns: conversation.userTurns,
      transcript: conversation.transcript,
      profile: conversation.profile,
      crossword,
      crosswordWords,
      error: null,
    };
  } catch (error) {
    return {
      ...base,
      finalized: false,
      reachedCap: false,
      userTurns: 0,
      transcript: [],
      profile: null,
      crossword: null,
      crosswordWords: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// --- CLI -------------------------------------------------------------------

interface CliOptions {
  runs: number;
  arm: string;
  only: string[] | null;
}

function parseCliArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { runs: 3, arm: "baseline", only: null };
  for (const arg of argv) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    if (key === "runs" && value) opts.runs = Number.parseInt(value, 10);
    else if (key === "arm" && value) opts.arm = value;
    else if (key === "only" && value) {
      opts.only = value.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  if (!Number.isFinite(opts.runs) || opts.runs < 1) opts.runs = 3;
  return opts;
}

async function main(): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY is not set — cannot run the sweep.");
    process.exit(1);
  }

  const opts = parseCliArgs(process.argv.slice(2));
  const oracleModelId =
    process.env.OPENROUTER_MODEL ?? "moonshotai/kimi-k2.6";
  const userModelId = process.env.OPENROUTER_USER_MODEL ?? oracleModelId;

  const openrouter = createOpenAI({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY,
  });
  const oracleModel = openrouter.chat(oracleModelId);
  const userModel = openrouter.chat(userModelId);

  mkdirSync(RUNS_DIR, { recursive: true });

  let personas = loadAllPersonas();
  if (opts.only) {
    const wanted = new Set(opts.only);
    personas = personas.filter((p) => wanted.has(p.id));
  }
  if (personas.length === 0) {
    console.error("No personas matched. Check --only.");
    process.exit(1);
  }

  console.log(
    `Sweep: ${personas.length} personas x ${opts.runs} runs, arm "${opts.arm}", ` +
      `oracle=${oracleModelId} user=${userModelId}`,
  );

  let ran = 0;
  let skipped = 0;
  for (const persona of personas) {
    for (let runIndex = 1; runIndex <= opts.runs; runIndex += 1) {
      const fileName = runFileName(persona.id, opts.arm, runIndex);
      if (cellIsDone(RUNS_DIR, fileName)) {
        skipped += 1;
        console.log(`  skip  ${fileName} (already present)`);
        continue;
      }

      console.log(`  run   ${fileName} ...`);
      const record = await runCell({
        persona,
        arm: opts.arm,
        runIndex,
        oracleModel,
        userModel,
        oracleModelId,
        userModelId,
        finishedAt: new Date().toISOString(),
      });
      writeFileSync(
        join(RUNS_DIR, fileName),
        JSON.stringify(record, null, 2) + "\n",
      );
      ran += 1;
      const status = record.error
        ? `error: ${record.error}`
        : record.finalized
          ? `finalized in ${record.userTurns} turns`
          : `NO finalize (cap ${record.turnCap})`;
      console.log(`        ${status}`);
    }
  }

  console.log(`Done. ${ran} run(s) written, ${skipped} skipped.`);
}

if (import.meta.main) {
  await main();
}
