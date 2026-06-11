"use client";

import { useCallback, useEffect, useState } from "react";
import type { VocalEmotionResult } from "@/lib/valence";
import Image from "next/image";
import type { ExperienceProfile } from "@/lib/types";
import type { OraclePersonaId } from "@/lib/oracle-personas";
import { personaForDialState } from "@/lib/oracle-personas";
import { setActiveOraclePersonaId } from "@/lib/oracle-chat-persona";
import { useDebugVoice } from "@/hooks/use-debug-voice";
import { useOracleChat } from "@/hooks/use-oracle-chat";
import { useOracleVoice } from "@/hooks/use-oracle-voice";
import { useOracleScribe } from "@/hooks/use-oracle-scribe";
import {
  TV_SCENE_ASPECT,
  TV_SCENE_GLASS,
} from "@/lib/tv-scene-assets";
import { TV_SCENE_PLATE_SRC } from "@/lib/tv-dial-states";
import {
  TV_GLASS_MAP,
  TV_VIEWPORT_RADIUS,
  insetContentStyle,
  percentRectStyle,
  type TvDialState,
} from "@/lib/tv-screen-map";
import { TvOracleFeed } from "@/components/intake/tv-oracle-feed";
import { FloatingComposer } from "@/components/intake/floating-composer";
import { TvVolumeDial } from "@/components/intake/tv-volume-dial";

interface OracleTvSceneProps {
  onFinalize: (profile: ExperienceProfile) => void;
}

export function OracleTvScene({ onFinalize }: OracleTvSceneProps) {
  const [dialState, setDialState] = useState<TvDialState>(0);
  const [lastVocalEmotion, setLastVocalEmotion] =
    useState<VocalEmotionResult | null>(null);
  const persona = personaForDialState(dialState);
  const personaId = persona.id as OraclePersonaId;
  const { voiceApisEnabled } = useDebugVoice();

  const chat = useOracleChat(onFinalize, personaId);

  const handleOracleSubmit = useCallback(
    (text: string, vocalEmotion?: VocalEmotionResult) => {
      setLastVocalEmotion(vocalEmotion ?? null);
      chat.submit(text, vocalEmotion);
    },
    [chat.submit],
  );

  const handleTypedSubmit = useCallback(
    (e: React.FormEvent) => {
      setLastVocalEmotion(null);
      chat.handleSubmit(e);
    },
    [chat.handleSubmit],
  );
  const voice = useOracleVoice({
    personaId,
    messages: chat.messages,
    status: chat.status,
    vocalEmotion: lastVocalEmotion,
    openingLine: chat.openingLine,
  });

  const handleStartListening = useCallback(() => {
    voice.cancelSpeech();
    voice.consumePendingReplies();
  }, [voice.cancelSpeech, voice.consumePendingReplies]);

  const scribe = useOracleScribe({
    disabled: chat.busy || !voiceApisEnabled,
    onPartial: chat.setText,
    onSubmit: handleOracleSubmit,
    onStartListening: handleStartListening,
  });

  useEffect(() => {
    if (!voiceApisEnabled) {
      voice.cancelSpeech();
    }
  }, [voiceApisEnabled, voice.cancelSpeech]);

  const handleDialChange = useCallback((state: TvDialState) => {
    setActiveOraclePersonaId(personaForDialState(state).id);
    setDialState(state);
  }, []);

  const glassStyle = percentRectStyle(TV_GLASS_MAP);
  const onAir =
    voice.isSpeaking ||
    (chat.status === "streaming" && chat.assistantStreamingText);

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
            src={TV_SCENE_PLATE_SRC}
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
                isSpeaking={onAir}
                vocalEmotion={lastVocalEmotion}
                openingLine={chat.openingLine}
                channelLabel={persona.label}
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

          <TvVolumeDial
            state={dialState}
            onStateChange={handleDialChange}
            channelLabel={persona.label}
          />
        </div>
      </div>

      <FloatingComposer
        text={chat.text}
        onTextChange={chat.setText}
        onSubmit={handleTypedSubmit}
        busy={chat.busy}
        status={chat.status}
        modelResponding={chat.assistantStreamingText}
        error={chat.error}
        onDismissError={chat.clearError}
        voiceError={voice.voiceError}
        onDismissVoiceError={voice.clearVoiceError}
        scribeError={scribe.scribeError}
        onDismissScribeError={scribe.clearScribeError}
        micListening={scribe.isListening}
        micConnecting={scribe.isConnecting}
        micDisabled={chat.busy}
        onMicToggle={voiceApisEnabled ? scribe.toggleMic : undefined}
        channelLabel={persona.label}
      />
    </section>
  );
}
