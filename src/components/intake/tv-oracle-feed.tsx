"use client";

import { useEffect, useRef } from "react";
import type { OracleUIMessage } from "@/lib/oracle-tools";
import { PaletteCard } from "@/components/intake/palette-card";
import { Spinner } from "@/components/ui/spinner";
import type { OracleChatStatus } from "@/hooks/use-oracle-chat";
import type { VocalEmotionResult } from "@/lib/valence";
import { crtToneClassForEmotion } from "@/lib/vocal-emotion-crt";

interface TvOracleFeedProps {
  messages: OracleUIMessage[];
  status: OracleChatStatus;
  modelResponding: boolean;
  isSpeaking?: boolean;
  vocalEmotion?: VocalEmotionResult | null;
  openingLine: string;
  channelLabel?: string;
}

export function TvOracleFeed({
  messages,
  status,
  modelResponding,
  isSpeaking = false,
  vocalEmotion = null,
  openingLine,
  channelLabel,
}: TvOracleFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const speakingClass = isSpeaking ? "is-speaking" : "";
  const toneClass =
    isSpeaking && vocalEmotion?.emotion
      ? crtToneClassForEmotion(vocalEmotion.emotion)
      : "";
  const thinking =
    status === "submitted" || (status === "streaming" && !modelResponding);

  return (
    <div
      className={["oracle-tv-feed", speakingClass, toneClass]
        .filter(Boolean)
        .join(" ")}
      aria-live="polite"
      aria-label="Oracle broadcast"
    >
      <div ref={scrollRef} className="oracle-tv-feed__scroll">
        {channelLabel ? (
          <p className="oracle-tv-feed__channel" aria-hidden>
            {channelLabel}
          </p>
        ) : null}

        <p className="oracle-tv-feed__line">{openingLine}</p>

        {messages.map((message) => {
          if (message.role === "user") {
            return <UserTurn key={message.id} message={message} />;
          }
          if (message.role === "assistant") {
            return <AssistantBroadcast key={message.id} message={message} />;
          }
          return null;
        })}

        {thinking ? (
          <div className="oracle-tv-feed__status" role="status">
            <Spinner className="size-3 shrink-0 text-[#9dff9d]/80" aria-hidden />
            <span className="oracle-tv-feed__status-text">Static…</span>
          </div>
        ) : null}

        {isSpeaking && !thinking ? (
          <div className="oracle-tv-feed__status" role="status">
            <span className="oracle-tv-feed__status-text">On air.</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function extractMessageText(message: OracleUIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

function UserTurn({ message }: { message: OracleUIMessage }) {
  const text = extractMessageText(message);
  if (!text) return null;

  return (
    <div className="oracle-tv-feed__user-turn">
      <p className="oracle-tv-feed__user-line">{text}</p>
    </div>
  );
}

function AssistantBroadcast({ message }: { message: OracleUIMessage }) {
  return (
    <div className="oracle-tv-feed__turn">
      {message.parts.map((part, i) => {
        if (part.type === "text" && part.text.trim()) {
          return (
            <p key={i} className="oracle-tv-feed__line">
              {part.text}
            </p>
          );
        }
        if (part.type === "tool-showPalette") {
          if (
            part.state === "output-error" ||
            (part.state === "output-available" &&
              part.output &&
              typeof part.output === "object" &&
              "ok" in part.output &&
              part.output.ok === false)
          ) {
            return null;
          }
          if (
            (part.state === "input-available" ||
              part.state === "output-available") &&
            part.input
          ) {
            return (
              <PaletteCard
                key={i}
                filmId={part.input.filmId}
                promptText={part.input.promptText}
                variant="crt"
              />
            );
          }
        }
        return null;
      })}
    </div>
  );
}
