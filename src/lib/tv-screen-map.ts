import type { CSSProperties } from "react";

/** Master plate pixel size — all maps are percentage of this canvas. */
const TV_SCENE_WIDTH = 2400;
const TV_SCENE_HEIGHT = 1792;

/** Visual QA nudge on the 2400×1792 plate (move overlay up/left). */
const TV_GLASS_NUDGE_PX = { top: -68, left: -102 } as const;

const TV_GLASS_DETECTED = {
  top: 20.089286,
  left: 28.333333,
  width: (1096 / TV_SCENE_WIDTH) * 100,
  height: (812 / TV_SCENE_HEIGHT) * 100,
} as const;

/**
 * TV-screen.png on TV-scene-dial-01 (1096×812).
 * Overlays share the plate coordinate space (object-fill frame, no letterboxing).
 */
export const TV_GLASS_MAP = {
  top: TV_GLASS_DETECTED.top + (TV_GLASS_NUDGE_PX.top / TV_SCENE_HEIGHT) * 100,
  left: TV_GLASS_DETECTED.left + (TV_GLASS_NUDGE_PX.left / TV_SCENE_WIDTH) * 100,
  width: TV_GLASS_DETECTED.width,
  height: TV_GLASS_DETECTED.height,
} as const;

/** Keep phosphor copy off the curved CRT corners. */
const TV_CONTENT_INSET = {
  top: 9,
  right: 8,
  bottom: 11,
  left: 8,
} as const;

/** Matches the rounded CRT face (not a sharp rectangle). */
export const TV_VIEWPORT_RADIUS = "5.5% / 7%";

/**
 * Right VHF dial on TV-scene-dial-01 (186×184 Figma export).
 * Position template-matched against TV-dial-state-02 on the 2400×1792 plate.
 */
export const TV_VOLUME_DIAL_MAP = {
  top: 69.642857,
  left: 57.25,
  width: (186 / TV_SCENE_WIDTH) * 100,
  height: (184 / TV_SCENE_HEIGHT) * 100,
} as const;

export type TvDialState = 0 | 1 | 2;

export interface PercentRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function percentRectStyle(rect: PercentRect): CSSProperties {
  return {
    top: `${rect.top}%`,
    left: `${rect.left}%`,
    width: `${rect.width}%`,
    height: `${rect.height}%`,
  };
}

export function insetContentStyle(): CSSProperties {
  const i = TV_CONTENT_INSET;
  return {
    top: `${i.top}%`,
    right: `${i.right}%`,
    bottom: `${i.bottom}%`,
    left: `${i.left}%`,
  };
}
