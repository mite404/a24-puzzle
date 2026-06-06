"use client";

import Image from "next/image";
import type { ExperienceProfile } from "@/lib/types";
import { useOracleChat } from "@/hooks/use-oracle-chat";
import {
  TV_SCENE_ASPECT,
  TV_SCENE_GLASS,
  TV_SCENE_PLATE,
} from "@/lib/tv-scene-assets";
import {
  TV_GLASS_MAP,
  TV_VIEWPORT_RADIUS,
  insetContentStyle,
  percentRectStyle,
} from "@/lib/tv-screen-map";
import { TvOracleFeed } from "@/components/intake/tv-oracle-feed";
import { FloatingComposer } from "@/components/intake/floating-composer";
import { TvVolumeDial } from "@/components/intake/tv-volume-dial";

interface OracleTvSceneProps {
  onFinalize: (profile: ExperienceProfile) => void;
}

export function OracleTvScene({ onFinalize }: OracleTvSceneProps) {
  const chat = useOracleChat(onFinalize);
  const glassStyle = percentRectStyle(TV_GLASS_MAP);

  return (
    <section
      className="oracle-tv-scene relative flex min-h-[calc(100dvh-3.5rem)] w-full flex-1 flex-col overflow-hidden"
      aria-label="Basement oracle consultation"
    >
      <div className="oracle-tv-scene__vignette pointer-events-none absolute inset-0 z-20" />

      <div className="oracle-tv-scene__stage relative mx-auto flex w-full max-w-[120rem] flex-1 items-center justify-center px-[clamp(0.5rem,2vw,1.5rem)] pb-[clamp(7rem,18vh,10rem)] pt-[clamp(0.5rem,2vh,1.5rem)]">
        <div
          className="oracle-tv-scene__frame relative shrink-0"
          style={{
            aspectRatio: TV_SCENE_ASPECT,
            width: "min(100%, calc((100dvh - 11rem) * 1.339))",
          }}
        >
          <Image
            src={TV_SCENE_PLATE}
            alt=""
            fill
            priority
            sizes="100vw"
            className="oracle-tv-scene__plate object-fill"
          />

          <div
            className="oracle-tv-scene__viewport absolute overflow-hidden"
            style={{
              ...glassStyle,
              borderRadius: TV_VIEWPORT_RADIUS,
            }}
          >
            <div
              className="oracle-tv-scene__content absolute overflow-hidden"
              style={insetContentStyle()}
            >
              <TvOracleFeed
                messages={chat.messages}
                status={chat.status}
                modelResponding={chat.assistantStreamingText}
              />
            </div>
          </div>

          <div
            className="oracle-tv-scene__glass-wrap pointer-events-none absolute overflow-hidden"
            style={glassStyle}
          >
            <Image
              src={TV_SCENE_GLASS}
              alt=""
              fill
              sizes="50vw"
              aria-hidden
              className="oracle-tv-scene__glass object-fill"
            />
          </div>

          <TvVolumeDial />
        </div>
      </div>

      <FloatingComposer
        text={chat.text}
        onTextChange={chat.setText}
        onSubmit={chat.handleSubmit}
        busy={chat.busy}
        status={chat.status}
        modelResponding={chat.assistantStreamingText}
        error={chat.error}
        onDismissError={chat.clearError}
      />
    </section>
  );
}
