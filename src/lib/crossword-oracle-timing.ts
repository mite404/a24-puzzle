import type { PlacedWord } from "@/lib/types";

export const DWELL_IDLE_20_MS = 20_000;
export const DWELL_IDLE_45_MS = 45_000;
export const IDLE_QUIP_COOLDOWN_MS = 12_000;

export type DwellTier = "idle20" | "idle45";

export interface CrosswordOracleTimingState {
  activeClueId: string | null;
  dwellStartedAtMs: number | null;
  firedIdle20: boolean;
  firedIdle45: boolean;
  dwellCycleComplete: boolean;
  lastSpokenAtMs: number;
  firstClueAutoReadDone: boolean;
}

export function createInitialTimingState(nowMs = 0): CrosswordOracleTimingState {
  return {
    activeClueId: null,
    dwellStartedAtMs: null,
    firedIdle20: false,
    firedIdle45: false,
    dwellCycleComplete: false,
    lastSpokenAtMs: nowMs,
    firstClueAutoReadDone: false,
  };
}

export function clueId(word: PlacedWord | null | undefined): string | null {
  return word?.id ?? null;
}

function resetDwellForClue(
  state: CrosswordOracleTimingState,
  clueIdValue: string | null,
  nowMs: number,
): CrosswordOracleTimingState {
  return {
    ...state,
    activeClueId: clueIdValue,
    dwellStartedAtMs: clueIdValue ? nowMs : null,
    firedIdle20: false,
    firedIdle45: false,
    dwellCycleComplete: false,
  };
}

/** Active clue changed — restart dwell cycle for the new clue. */
export function onActiveClueChange(
  state: CrosswordOracleTimingState,
  word: PlacedWord | null,
  nowMs: number,
): CrosswordOracleTimingState {
  const nextId = clueId(word);
  if (nextId === state.activeClueId) return state;
  return resetDwellForClue(state, nextId, nowMs);
}

/** Active word became fully filled — stop teasing that clue. */
export function onWordFilled(
  state: CrosswordOracleTimingState,
  word: PlacedWord,
  nowMs: number,
): CrosswordOracleTimingState {
  const filledId = clueId(word);
  if (filledId !== state.activeClueId) {
    return { ...state, lastSpokenAtMs: nowMs };
  }
  return {
    ...state,
    dwellStartedAtMs: null,
    firedIdle20: false,
    firedIdle45: false,
    dwellCycleComplete: true,
    lastSpokenAtMs: nowMs,
  };
}

export function markSpoken(
  state: CrosswordOracleTimingState,
  nowMs: number,
): CrosswordOracleTimingState {
  return { ...state, lastSpokenAtMs: nowMs };
}

export function markFirstClueAutoRead(
  state: CrosswordOracleTimingState,
): CrosswordOracleTimingState {
  return { ...state, firstClueAutoReadDone: true };
}

export function canFireIdleQuip(
  state: CrosswordOracleTimingState,
  nowMs: number,
): boolean {
  return nowMs - state.lastSpokenAtMs >= IDLE_QUIP_COOLDOWN_MS;
}

export interface DwellTickInput {
  state: CrosswordOracleTimingState;
  nowMs: number;
  isSpeaking: boolean;
}

/** Returns the idle tier due, if any. Does not mutate fired flags — caller applies. */
export function getDueDwellTier(input: DwellTickInput): DwellTier | null {
  const { state, nowMs, isSpeaking } = input;
  if (isSpeaking) return null;
  if (!state.activeClueId || state.dwellStartedAtMs === null) return null;
  if (state.dwellCycleComplete) return null;
  if (!canFireIdleQuip(state, nowMs)) return null;

  const elapsed = nowMs - state.dwellStartedAtMs;
  if (!state.firedIdle20 && elapsed >= DWELL_IDLE_20_MS) return "idle20";
  if (!state.firedIdle45 && state.firedIdle20 && elapsed >= DWELL_IDLE_45_MS) {
    return "idle45";
  }
  return null;
}

export function applyDwellTierFired(
  state: CrosswordOracleTimingState,
  tier: DwellTier,
): CrosswordOracleTimingState {
  if (tier === "idle20") {
    return { ...state, firedIdle20: true };
  }
  return {
    ...state,
    firedIdle45: true,
    dwellCycleComplete: true,
  };
}

export function sortWordsByClueNumber(words: PlacedWord[]): PlacedWord[] {
  return [...words].sort((a, b) => a.position - b.position);
}

export function firstClueWord(words: PlacedWord[]): PlacedWord | null {
  const sorted = sortWordsByClueNumber(words);
  return sorted[0] ?? null;
}
