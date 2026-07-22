/**
 * Blind-subagent judge bridge (substitute for `claude -p`, which is not logged in in
 * this container). It reuses judge.ts's pure core so the produced scores/*.json are
 * byte-identical to the real CLI path:
 *
 *   --dump    for every blinded record without a score, write its buildJudgePrompt()
 *             output to evals/judge-prompts/<blindId>.txt. Each is fully blind (RUBRIC +
 *             transcript/words/clues/grid, zero identity), so a Claude subagent handed
 *             one file judges without ever seeing the persona/arm/run.
 *
 *   --ingest  for every evals/judge-replies/<blindId>.txt, run parseJudgeResponse (the
 *             same validation the CLI uses — the caller's blindId wins over any echo) and
 *             write scores/<blindId>.json in the JudgeResult schema.
 *
 * The subagent is the JudgeFn; bun cannot spawn agents, so the two-stage dump/ingest hands
 * the prompts out and takes the JSON back. Nothing here reads key.json.
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import {
  buildJudgePrompt,
  loadBlindRecords,
  parseJudgeResponse,
  scoreIsDone,
  CHECK_IDS,
} from "./judge";

const EVALS_DIR = import.meta.dir;
const BLIND_DIR = join(EVALS_DIR, "blind");
const SCORES_DIR = join(EVALS_DIR, "scores");
const PROMPTS_DIR = join(EVALS_DIR, "judge-prompts");
const REPLIES_DIR = join(EVALS_DIR, "judge-replies");
const RUBRIC_FILE = join(EVALS_DIR, "RUBRIC.md");

function dump(): void {
  const rubric = readFileSync(RUBRIC_FILE, "utf8");
  const blinded = loadBlindRecords(BLIND_DIR);
  mkdirSync(PROMPTS_DIR, { recursive: true });
  let written = 0;
  let skipped = 0;
  for (const { record } of blinded) {
    if (scoreIsDone(SCORES_DIR, record.blindId)) {
      skipped += 1;
      continue;
    }
    const prompt = buildJudgePrompt(record, rubric);
    writeFileSync(join(PROMPTS_DIR, `${record.blindId}.txt`), prompt);
    written += 1;
  }
  console.log(
    `Dumped ${written} judge prompt(s) to ${PROMPTS_DIR} (${skipped} already scored).`,
  );
}

function ingest(): void {
  mkdirSync(SCORES_DIR, { recursive: true });
  if (!existsSync(REPLIES_DIR)) {
    console.error(`No replies dir at ${REPLIES_DIR}.`);
    process.exit(1);
  }
  const replies = readdirSync(REPLIES_DIR).filter((f) => f.endsWith(".txt"));
  let scored = 0;
  let failed = 0;
  for (const file of replies) {
    const blindId = file.replace(/\.txt$/, "");
    const raw = readFileSync(join(REPLIES_DIR, file), "utf8");
    try {
      const result = parseJudgeResponse(raw, blindId);
      writeFileSync(
        join(SCORES_DIR, `${blindId}.json`),
        JSON.stringify(result, null, 2) + "\n",
      );
      scored += 1;
      const line = CHECK_IDS.map(
        (c) => `${c}:${result[c].pass ? "PASS" : "FAIL"}`,
      ).join(" ");
      console.log(`  ${blindId}  ${line}`);
    } catch (error) {
      failed += 1;
      console.log(
        `  ${blindId}  ERROR: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  console.log(`Ingested ${scored} score(s), ${failed} failed. Scores -> ${SCORES_DIR}`);
  if (failed > 0) process.exit(1);
}

if (import.meta.main) {
  const mode = process.argv[2];
  if (mode === "--dump") dump();
  else if (mode === "--ingest") ingest();
  else {
    console.error("usage: bun evals/judge-subagent.ts --dump | --ingest");
    process.exit(1);
  }
}
