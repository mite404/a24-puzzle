import { describe, expect, test } from "bun:test";
import type { PlacedWord } from "@/lib/types";
import {
  applyDwellTierFired,
  createInitialTimingState,
  DWELL_IDLE_20_MS,
  DWELL_IDLE_45_MS,
  firstClueWord,
  getDueDwellTier,
  IDLE_QUIP_COOLDOWN_MS,
  markSpoken,
  onActiveClueChange,
  onWordFilled,
} from "@/lib/crossword-oracle-timing";

const wordA: PlacedWord = {
  id: "a",
  answer: "MOON",
  clue: "Earth satellite",
  startx: 1,
  starty: 1,
  orientation: "across",
  position: 1,
};

const wordB: PlacedWord = {
  id: "b",
  answer: "ART",
  clue: "Gallery stuff",
  startx: 2,
  starty: 1,
  orientation: "down",
  position: 2,
};

describe("crossword oracle dwell timing", () => {
  test("escalates idle20 then idle45 on the same clue", () => {
    let state = createInitialTimingState(0);
    state = onActiveClueChange(state, wordA, 0);

    expect(
      getDueDwellTier({ state, nowMs: DWELL_IDLE_20_MS - 1, isSpeaking: false }),
    ).toBeNull();
    expect(
      getDueDwellTier({ state, nowMs: DWELL_IDLE_20_MS, isSpeaking: false }),
    ).toBe("idle20");

    state = applyDwellTierFired(state, "idle20");
    state = markSpoken(state, DWELL_IDLE_20_MS);

    expect(
      getDueDwellTier({
        state,
        nowMs: DWELL_IDLE_45_MS - 1,
        isSpeaking: false,
      }),
    ).toBeNull();
    expect(
      getDueDwellTier({
        state,
        nowMs: DWELL_IDLE_45_MS,
        isSpeaking: false,
      }),
    ).toBe("idle45");
  });

  test("respects global idle cooldown after any spoken line", () => {
    let state = createInitialTimingState(0);
    state = onActiveClueChange(state, wordA, 0);
    state = markSpoken(state, 5_000);

    expect(
      getDueDwellTier({
        state,
        nowMs: 5_000 + IDLE_QUIP_COOLDOWN_MS - 1,
        isSpeaking: false,
      }),
    ).toBeNull();
    expect(
      getDueDwellTier({
        state,
        nowMs: 5_000 + IDLE_QUIP_COOLDOWN_MS,
        isSpeaking: false,
      }),
    ).toBeNull();
    expect(
      getDueDwellTier({
        state,
        nowMs: DWELL_IDLE_20_MS,
        isSpeaking: false,
      }),
    ).toBe("idle20");
  });

  test("resets dwell on active clue change", () => {
    let state = createInitialTimingState(0);
    state = onActiveClueChange(state, wordA, 0);
    state = applyDwellTierFired(state, "idle20");
    state = markSpoken(state, DWELL_IDLE_20_MS);

    state = onActiveClueChange(state, wordB, DWELL_IDLE_20_MS + 1_000);
    expect(state.firedIdle20).toBe(false);
    expect(state.firedIdle45).toBe(false);
    expect(state.dwellCycleComplete).toBe(false);
    expect(state.activeClueId).toBe("b");
  });

  test("resets dwell when active word is filled", () => {
    let state = createInitialTimingState(0);
    state = onActiveClueChange(state, wordA, 0);
    state = applyDwellTierFired(state, "idle20");
    state = markSpoken(state, DWELL_IDLE_20_MS);

    state = onWordFilled(state, wordA, DWELL_IDLE_20_MS + 500);
    expect(state.dwellCycleComplete).toBe(true);
    expect(
      getDueDwellTier({
        state,
        nowMs: DWELL_IDLE_20_MS + DWELL_IDLE_45_MS,
        isSpeaking: false,
      }),
    ).toBeNull();
  });

  test("allows only one dwell escalation cycle per clue", () => {
    let state = createInitialTimingState(0);
    state = onActiveClueChange(state, wordA, 0);
    state = applyDwellTierFired(state, "idle20");
    state = markSpoken(state, DWELL_IDLE_20_MS);
    state = applyDwellTierFired(state, "idle45");
    state = markSpoken(state, DWELL_IDLE_20_MS + DWELL_IDLE_45_MS);

    expect(
      getDueDwellTier({
        state,
        nowMs: DWELL_IDLE_20_MS + DWELL_IDLE_45_MS + 60_000,
        isSpeaking: false,
      }),
    ).toBeNull();
  });

  test("does not fire while speaking", () => {
    let state = createInitialTimingState(0);
    state = onActiveClueChange(state, wordA, 0);
    expect(
      getDueDwellTier({ state, nowMs: DWELL_IDLE_20_MS, isSpeaking: true }),
    ).toBeNull();
  });

  test("firstClueWord picks lowest clue number", () => {
    expect(firstClueWord([wordB, wordA])?.id).toBe("a");
  });
});
