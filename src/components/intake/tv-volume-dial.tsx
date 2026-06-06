"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import { TV_DIAL_SPRITES } from "@/lib/tv-dial-states";
import {
  TV_VOLUME_DIAL_MAP,
  percentRectStyle,
  type TvDialState,
} from "@/lib/tv-screen-map";

interface TvVolumeDialProps {
  state?: TvDialState;
  /** Fires when the knob snaps to a new detent — swaps persona + voice. */
  onStateChange?: (state: TvDialState) => void;
  channelLabel?: string;
}

export function TvVolumeDial({
  state: controlledState,
  onStateChange,
  channelLabel,
}: TvVolumeDialProps) {
  const [internalState, setInternalState] = useState<TvDialState>(0);
  const state = controlledState ?? internalState;

  const cycle = useCallback(() => {
    const next = ((state + 1) % 3) as TvDialState;
    if (controlledState === undefined) {
      setInternalState(next);
    }
    onStateChange?.(next);
  }, [controlledState, onStateChange, state]);

  const sprite = state > 0 ? TV_DIAL_SPRITES[state as 1 | 2] : null;

  return (
    <button
      type="button"
      className="oracle-tv-dial group absolute z-[5] cursor-pointer border-0 bg-transparent p-0"
      style={percentRectStyle(TV_VOLUME_DIAL_MAP)}
      onClick={cycle}
      aria-label={
        channelLabel
          ? `${channelLabel} — click to change oracle channel`
          : state === 0
            ? "Tune the oracle channel"
            : `Oracle channel ${state + 1} — click to change`
      }
    >
      <span
        className="oracle-tv-dial__ring pointer-events-none absolute inset-0 rounded-full opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100"
        aria-hidden
      />

      {sprite ? (
        <Image
          key={state}
          src={sprite}
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
