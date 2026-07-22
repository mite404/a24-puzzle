/**
 * evals/score.ts — stage 4 (final) of the blind eval harness (see specs/eval-harness.md).
 *
 * Joins the judge's verdicts in evals/scores/ back to their real identities in
 * evals/blind/key.json (the UNBLINDING step — this is the one stage allowed to read
 * key.json), aggregates them, and prints a per-block report. A "block" here is one rubric
 * check (c1..c5); for each block we report a pass rate PER ARM, never a single combined
 * headline number, because RUBRIC.md's reporting rule forbids collapsing the checks into one
 * score.
 *
 * A block is SATURATED when every arm passes it on every run — the check has stopped
 * discriminating between arms, so a maxed-out block is uninformative, not a win. score.ts
 * prints an explicit `CEILING` warning for exactly that case, mirroring adhd-eval's
 * score.py. c5 (factually correct — never drop) additionally gets an unblinded audit list of
 * every failure, since a single wrong clue is the most consequential verdict this harness
 * returns and a human must be able to spot-check it.
 *
 * Pure helpers (joining, aggregation, report formatting) are exported for unit tests; the
 * filesystem reads and the CLI run only under `import.meta.main`, so importing this module in
 * a test touches no disk.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { BlindKey, KeyEntry } from "./blind";
import { CHECK_IDS, type CheckId, type JudgeResult } from "./judge";

// --- Directories -----------------------------------------------------------

const EVALS_DIR = import.meta.dir;
const SCORES_DIR = join(EVALS_DIR, "scores");
const KEY_FILE = join(EVALS_DIR, "blind", "key.json");

// --- Unblinding: join verdicts to identities (pure) ------------------------

/** One judged puzzle with its identity restored — the output of unblinding. */
export interface ScoredCell {
  blindId: string;
  arm: string;
  persona: string;
  axis: string;
  runIndex: number;
  gatesPassed: boolean;
  finalized: boolean;
  verdict: JudgeResult;
}

/** The result of joining scores to the key: matched cells plus the two mismatch sets. */
export interface JoinResult {
  cells: ScoredCell[];
  /** blindIds that were scored but have no entry in key.json (should never happen). */
  unmatchedScores: string[];
  /** blindIds present in key.json that have no score yet — the un-judged remainder. */
  unjudged: string[];
}

/**
 * Restore identity to each verdict by looking its blindId up in the key. Pure: no
 * filesystem. A score with no key entry is surfaced in `unmatchedScores` (never silently
 * dropped), and a key entry with no score is surfaced in `unjudged` so the report can state
 * coverage honestly rather than pretending an un-judged cell doesn't exist.
 */
export function joinScores(scores: JudgeResult[], key: BlindKey): JoinResult {
  const cells: ScoredCell[] = [];
  const unmatchedScores: string[] = [];
  const scored = new Set<string>();

  for (const verdict of scores) {
    scored.add(verdict.blindId);
    const entry: KeyEntry | undefined = key.entries[verdict.blindId];
    if (!entry) {
      unmatchedScores.push(verdict.blindId);
      continue;
    }
    cells.push({
      blindId: verdict.blindId,
      arm: entry.arm,
      persona: entry.persona,
      axis: entry.axis,
      runIndex: entry.runIndex,
      gatesPassed: entry.gatesPassed,
      finalized: entry.finalized,
      verdict,
    });
  }

  const unjudged = Object.keys(key.entries).filter((id) => !scored.has(id));
  return { cells, unmatchedScores, unjudged };
}

// --- Aggregation per block (pure) ------------------------------------------

/** One arm's tally for a single check: how many of its runs passed. */
export interface ArmStat {
  arm: string;
  passed: number;
  total: number;
  /** passed / total, or 0 when the arm has no runs. */
  rate: number;
}

/** The per-arm pass rates for one rubric check, plus whether the block is saturated. */
export interface CheckReport {
  check: CheckId;
  perArm: ArmStat[];
  /**
   * True when every arm that has runs passed this check on EVERY run — the block no longer
   * discriminates between arms, so it earns a CEILING warning.
   */
  ceiling: boolean;
}

/** Distinct arm names present in the cells, sorted for a stable report order. */
export function armsOf(cells: ScoredCell[]): string[] {
  return [...new Set(cells.map((c) => c.arm))].sort();
}

/**
 * Aggregate the cells into one CheckReport per rubric check. Each report holds a pass
 * rate for every arm, and the `ceiling` flag is set when every arm maxed the check out.
 * Pure: same cells -> same reports.
 */
export function aggregateChecks(cells: ScoredCell[]): CheckReport[] {
  const arms = armsOf(cells);
  return CHECK_IDS.map((check) => {
    const perArm: ArmStat[] = arms.map((arm) => {
      const armCells = cells.filter((c) => c.arm === arm);
      const passed = armCells.filter((c) => c.verdict[check].pass).length;
      const total = armCells.length;
      return { arm, passed, total, rate: total > 0 ? passed / total : 0 };
    });
    const withRuns = perArm.filter((a) => a.total > 0);
    const ceiling =
      withRuns.length > 0 && withRuns.every((a) => a.passed === a.total);
    return { check, perArm, ceiling };
  });
}

/** Every c5 failure, unblinded, so a human can audit the never-drop check by hand. */
export function c5Failures(cells: ScoredCell[]): ScoredCell[] {
  return cells.filter((c) => !c.verdict.c5.pass);
}

// --- Report formatting (pure) ----------------------------------------------

function pct(rate: number): string {
  return `${(rate * 100).toFixed(0)}%`;
}

/** One-line label for a check, so the report is readable without opening RUBRIC.md. */
const CHECK_LABELS: Record<CheckId, string> = {
  c1: "on-topic",
  c2: "solvable",
  c3: "mixed difficulty",
  c4: "no duplicates",
  c5: "factually correct (NEVER DROP)",
};

/**
 * Render the whole aggregate report as text. Pure: no I/O, so tests assert against the exact
 * string. Leads with coverage, then one block per check (per-arm rates + a CEILING line when
 * saturated), then the unblinded c5 audit.
 */
export function formatReport(join: JoinResult, reports: CheckReport[]): string {
  const { cells, unmatchedScores, unjudged } = join;
  const arms = armsOf(cells);
  const lines: string[] = [];

  lines.push("=== Eval score report (per-block, never a single headline) ===");
  lines.push("");
  lines.push(
    `Scored ${cells.length} cell(s) across ${arms.length} arm(s): ` +
      (arms.length > 0 ? arms.join(", ") : "(none)"),
  );
  if (unjudged.length > 0) {
    lines.push(`Un-judged (in key, no score yet): ${unjudged.length}`);
  }
  if (unmatchedScores.length > 0) {
    lines.push(
      `WARNING: ${unmatchedScores.length} score(s) had no key entry: ` +
        unmatchedScores.join(", "),
    );
  }
  lines.push("");

  if (cells.length === 0) {
    lines.push("No scored cells to aggregate. Run judge.ts first.");
    return lines.join("\n");
  }

  for (const report of reports) {
    lines.push(`${report.check} — ${CHECK_LABELS[report.check]}`);
    for (const a of report.perArm) {
      lines.push(`  ${a.arm}: ${a.passed}/${a.total} (${pct(a.rate)})`);
    }
    if (report.ceiling) {
      lines.push(
        `  CEILING: every arm passed every run — this block no longer discriminates.`,
      );
    }
    lines.push("");
  }

  const c5Fails = c5Failures(cells);
  lines.push(`c5 audit — factually-correct failures: ${c5Fails.length}`);
  if (c5Fails.length === 0) {
    lines.push("  (none — no clue was judged factually wrong)");
  } else {
    for (const c of c5Fails) {
      lines.push(
        `  ${c.persona} [${c.axis}] ${c.arm} run${c.runIndex} (${c.blindId}): ${c.verdict.c5.why}`,
      );
    }
  }

  return lines.join("\n");
}

// --- Filesystem (impure; only reached from the CLI) ------------------------

/** Read every scored verdict in `scoresDir`, sorted for stable order. */
export function loadScores(scoresDir: string): JudgeResult[] {
  if (!existsSync(scoresDir)) return [];
  return readdirSync(scoresDir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((fileName) => {
      const raw = readFileSync(join(scoresDir, fileName), "utf8");
      return JSON.parse(raw) as JudgeResult;
    });
}

/** Load the unblinding key. This is the one stage allowed to read key.json. */
export function loadKey(keyFile: string): BlindKey {
  const raw = readFileSync(keyFile, "utf8");
  return JSON.parse(raw) as BlindKey;
}

function main(): void {
  if (!existsSync(KEY_FILE)) {
    console.error(`No key at ${KEY_FILE}. Run evals/blind.ts first.`);
    process.exit(1);
  }
  const scores = loadScores(SCORES_DIR);
  if (scores.length === 0) {
    console.error(`No scores in ${SCORES_DIR}. Run evals/judge.ts first.`);
    process.exit(1);
  }

  const key = loadKey(KEY_FILE);
  const joined = joinScores(scores, key);
  const reports = aggregateChecks(joined.cells);
  console.log(formatReport(joined, reports));
}

if (import.meta.main) {
  main();
}
