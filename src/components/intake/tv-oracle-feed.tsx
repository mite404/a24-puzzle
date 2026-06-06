"use client";

import { useEffect, useRef } from "react";
import type { OracleUIMessage } from "@/lib/oracle-tools";
import { PaletteCard } from "@/components/intake/palette-card";
import { Spinner } from "@/components/ui/spinner";
import {
  ORACLE_OPENING_LINE,
  type OracleChatStatus,
} from "@/hooks/use-oracle-chat";

interface TvOracleFeedProps {
  messages: OracleUIMessage[];
  status: OracleChatStatus;
  modelResponding: boolean;
}

export function TvOracleFeed({
  messages,
  status,
  modelResponding,
}: TvOracleFeedProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const speaking =
    status === "streaming" && modelResponding ? "is-speaking" : "";
  const thinking = status === "submitted" || (status === "streaming" && !modelResponding);

  return (
    <div
      className={`oracle-tv-feed ${speaking}`.trim()}
      aria-live="polite"
      aria-label="Oracle broadcast"
    >
      <div ref={scrollRef} className="oracle-tv-feed__scroll">
        <p className="oracle-tv-feed__line">{OPENING_LINE}</p>

        {messages.map((message) =>
          message.role === "assistant" ? (
            <AssistantBroadcast key={message.id} message={message} />
          ) : null,
        )}

        {thinking ? (
          <div className="oracle-tv-feed__status" role="status">
            <Spinner className="size-3 shrink-0 text-[#9dff9d]/80" aria-hidden />
            <span className="oracle-tv-feed__status-text">Static…</span>
          </div>
        ) : null}
      </div>
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

const OPENING_LINE = ORACLE_OPENING_LINE;
