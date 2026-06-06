"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import {
  TV_DIAL_STATE_02,
  TV_DIAL_STATE_03,
} from "@/lib/tv-scene-assets";
import {
  TV_VOLUME_DIAL_MAP,
  percentRectStyle,
  type TvDialState,
} from "@/lib/tv-screen-map";

const DIAL_SPRITES: Record<1 | 2, string> = {
  1: TV_DIAL_STATE_02,
  2: TV_DIAL_STATE_03,
};

interface TvVolumeDialProps {
  /** Fires when the knob snaps to a new detent (for future persona wiring). */
  onStateChange?: (state: TvDialState) => void;
}

export function TvVolumeDial({ onStateChange }: TvVolumeDialProps) {
  const [state, setState] = useState<TvDialState>(0);

  const cycle = useCallback(() => {
    setState((prev) => {
      const next = ((prev + 1) % 3) as TvDialState;
      onStateChange?.(next);
      return next;
    });
  }, [onStateChange]);

  return (
    <button
      type="button"
      className="oracle-tv-dial group absolute z-[5] cursor-pointer border-0 bg-transparent p-0"
      style={percentRectStyle(TV_VOLUME_DIAL_MAP)}
      onClick={cycle}
      aria-label={
        state === 0
          ? "Tune the oracle channel"
          : `Oracle channel ${state} — click to change`
      }
    >
      <span
        className="oracle-tv-dial__ring pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden
      />

      {state > 0 ? (
        <Image
          key={state}
          src={DIAL_SPRITES[state as 1 | 2]}
          alt=""
          fill
          sizes="120px"
          draggable={false}
          priority
          className="oracle-tv-dial__sprite object-fill"
        />
      ) : (
        <span className="sr-only">Default channel — click to tune</span>
      )}
    </button>
  );
}
