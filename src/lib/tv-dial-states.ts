import type { TvDialState } from "@/lib/tv-screen-map";
import {
  TV_DIAL_STATE_02,
  TV_DIAL_STATE_03,
  TV_SCENE_PLATE,
} from "@/lib/tv-scene-assets";
import type { OraclePersonaId } from "@/lib/oracle-personas";
import { dialStateForPersona, personaForDialState } from "@/lib/oracle-personas";

/** Knob overlay sprites keyed by dial detent (0 = base plate only). */
export const TV_DIAL_SPRITES: Partial<Record<1 | 2, string>> = {
  1: TV_DIAL_STATE_02,
  2: TV_DIAL_STATE_03,
};

/** Scene plate — same master for all states; knob sprites swap on top. */
export const TV_SCENE_PLATE_SRC = TV_SCENE_PLATE;

export function personaIdForDialState(state: TvDialState): OraclePersonaId {
  return personaForDialState(state).id;
}

export function dialStateForPersonaId(id: OraclePersonaId): TvDialState {
  return dialStateForPersona(id);
}
