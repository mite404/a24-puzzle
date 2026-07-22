import { describe, expect, test } from "bun:test";
import { crosswordBank } from "@/data/crosswordBank";
import type { ExperienceProfile } from "@/lib/types";
import { buildGamePayload } from "@/lib/game";

/**
 * Fuzz measurement for spec `crossword-layout.md`:
 *   "A fuzz test draws many random id sets from the bank and reports the observed
 *    placement rate (placed words / requested words)."
 *
 * WHY THIS IS DETERMINISTIC, NOT `Math.random`:
 *   The layout generator is deterministic (no `Math.random` in its source — see
 *   RALPH_NOTES.md), so a given id set always yields the same grid. The *only* source
 *   of variation here is which id sets we draw. Seeding that draw with a fixed PRNG
 *   makes the whole measurement reproducible: the number reported below is stable
 *   across runs, which is exactly what a "measured number written into RALPH_NOTES.md"
 *   requires, and it keeps this test from being flaky.
 *
 * WHAT "requested" MEANS:
 *   We only draw sets of size >= 4, so `resolveCrosswordEntries` never tops up (its
 *   threshold is < 4). Requested count therefore equals the drawn set size MINUS any
 *   `pairId` collisions, and placement rate = placed words / resolved count — the raw
 *   generator behaviour, not polluted by the top-up path.
 *
 * WHY THE DRAWN SIZE AND THE RESOLVED COUNT DIFFER:
 *   `resolveCrosswordEntries` drops the second half of a role/actor mirror pair
 *   (e.g. HARRY + PASCAL) so one grid never carries two clues restating the same fact
 *   (RUBRIC c4). A random draw can contain both halves, so resolving N ids can legitimately
 *   yield fewer than N entries. We compute the expected collision count from the drawn set
 *   and assert the resolved count matches EXACTLY — a looser `<= size` would have let a
 *   real regression in the resolver hide behind the dedup.
 */

/** A tiny seeded LCG (numerical-recipes constants) → reproducible fuzz. */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Fisher–Yates shuffle driven by the seeded rng (does not touch Math.random). */
function seededShuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const allBankIds = crosswordBank.map((e) => e.id);
const pairIdById = new Map(crosswordBank.map((e) => [e.id, e.pairId]));

/**
 * How many entries `resolveCrosswordEntries` will drop from this draw because a mirror
 * pair's other half is already in it. Keeping the first-seen member of each pair means
 * every member after the first is a drop.
 */
function expectedPairDrops(ids: string[]): number {
  const seen = new Set<string>();
  let drops = 0;
  for (const id of ids) {
    const pid = pairIdById.get(id);
    if (pid === undefined) continue;
    if (seen.has(pid)) drops++;
    else seen.add(pid);
  }
  return drops;
}

function profileFor(ids: string[]): ExperienceProfile {
  return {
    selectedFilmIds: ["uncut-gems"],
    moods: ["anxious"],
    crosswordWordIds: ids,
    locationIds: ["ug-diamond-district", "ug-midtown", "ug-les"],
  };
}

/** Placed / requested for one drawn id set. */
function placement(ids: string[]): { requested: number; placed: number } {
  const payload = buildGamePayload(profileFor(ids));
  return {
    requested: payload.crosswordWords.length,
    placed: payload.crossword?.words.length ?? 0,
  };
}

describe("crossword placement rate (fuzz, spec crossword-layout.md)", () => {
  // Generous timeout: this runs the layout generator ~700 times. It is CPU-bound and
  // fully deterministic (seeded), so it cannot hang — the bound just leaves headroom.
  test("draws many random id sets and reports the observed placement rate", () => {
    const rng = makeRng(0x51ac); // fixed seed → reproducible report
    const TRIALS_PER_SIZE = 64;
    const minSize = 4; // >= 4 so resolveCrosswordEntries never tops up
    // Cap the sweep: the generator cost grows superlinearly with word count, and the
    // bank now exceeds 30 entries (heading to ~70 in Phase 3). Sweeping the whole bank
    // times out and tells Phase 5 nothing new — P(>=8 placed) already saturates to 100%
    // by size 10, so the request-count region (4..16) is all the gate needs. The full
    // re-measure of the headline rate against the final bank is its own Phase 3 task.
    const maxSize = Math.min(allBankIds.length, 16);

    let totalRequested = 0;
    let totalPlaced = 0;
    // How many draws contained both halves of a mirror pair. Reported so the shrinkage
    // between "ids drawn" and "entries resolved" is visible rather than mysterious.
    let totalDrops = 0;

    // Per requested-set-size stats — Phase 5 derives the oracle's request count
    // from this table, so break the rate down by how many ids were asked for.
    const bySize: Array<{ size: number; meanPlaced: number; rate: number; atLeast8: number }> =
      [];

    for (let size = minSize; size <= maxSize; size++) {
      let sizePlaced = 0;
      let sizeRequested = 0;
      let atLeast8 = 0;
      let sizeDrops = 0;
      for (let t = 0; t < TRIALS_PER_SIZE; t++) {
        const ids = seededShuffle(allBankIds, rng).slice(0, size);
        const { requested, placed } = placement(ids);
        // invariant: you can never place more words than you fed the generator
        expect(placed).toBeLessThanOrEqual(requested);
        // The resolver drops mirror-pair duplicates and nothing else. Asserting the exact
        // predicted count (rather than `<= size`) keeps this a real regression check: if
        // the resolver ever started dropping or padding for any OTHER reason, this fails.
        const drops = expectedPairDrops(ids);
        expect(requested).toBe(size - drops);
        sizeDrops += drops;
        sizePlaced += placed;
        sizeRequested += requested;
        if (placed >= 8) atLeast8++;
      }
      totalPlaced += sizePlaced;
      totalRequested += sizeRequested;
      totalDrops += sizeDrops;
      bySize.push({
        size,
        meanPlaced: sizePlaced / TRIALS_PER_SIZE,
        rate: sizePlaced / sizeRequested,
        atLeast8: atLeast8 / TRIALS_PER_SIZE,
      });
    }

    const overallRate = totalPlaced / totalRequested;

    // Report (captured into RALPH_NOTES.md — this is the gated Phase 2 number).
    const lines = [
      `\n=== Crossword placement rate (seed 0x51ac, ${TRIALS_PER_SIZE} trials/size) ===`,
      `overall placement rate: ${(overallRate * 100).toFixed(1)}%  (${totalPlaced}/${totalRequested})` +
        `\nmirror-pair drops: ${totalDrops} (ids drawn but deduped before layout)`,
      "requested | mean placed | rate  | P(>=8 placed)",
      ...bySize.map(
        (r) =>
          `   ${String(r.size).padStart(2)}    |   ${r.meanPlaced.toFixed(2).padStart(5)}    | ${(
            r.rate * 100
          )
            .toFixed(1)
            .padStart(5)}%|   ${(r.atLeast8 * 100).toFixed(0).padStart(3)}%`,
      ),
    ];
    console.log(lines.join("\n"));

    // Assertions: only invariants that hold for *every* run. R1 ("at least 8 placed")
    // is deliberately NOT asserted here — measuring how often it fails is the point of
    // this phase, and forcing it green would hide the very defect the spec targets.
    expect(totalRequested).toBeGreaterThan(0);
    expect(overallRate).toBeGreaterThan(0);
    expect(overallRate).toBeLessThanOrEqual(1);
  }, 20000);
});
