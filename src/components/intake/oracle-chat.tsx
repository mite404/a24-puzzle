"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { OracleUIMessage } from "@/lib/oracle-tools";
import type { ExperienceProfile } from "@/lib/types";
import { PaletteCard } from "@/components/intake/palette-card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

const OPENING_LINE =
  "Sit with me a moment. Tell me how today actually feels — and which films, directors, or faces you keep circling back to lately.";

interface OracleChatProps {
  onFinalize: (profile: ExperienceProfile) => void;
}

export function OracleChat({ onFinalize }: OracleChatProps) {
  const { messages, sendMessage, status } = useChat<OracleUIMessage>();
  const [text, setText] = useState("");
  const finalized = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Watch for the oracle's finalizeExperience tool call; hand the profile up once.
  useEffect(() => {
    if (finalized.current) return;
    for (const message of messages) {
      for (const part of message.parts) {
        if (
          part.type === "tool-finalizeExperience" &&
          (part.state === "input-available" ||
            part.state === "output-available") &&
          part.input
        ) {
          finalized.current = true;
          onFinalize(part.input as ExperienceProfile);
          return;
        }
      }
    }
  }, [messages, onFinalize]);

  const busy = status === "submitted" || status === "streaming";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setText("");
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto py-2">
        {/* Oracle's hardcoded opening so the screen is never empty. */}
        <OracleLine>{OPENING_LINE}</OracleLine>

        {messages.map((message) => (
          <div key={message.id} className="space-y-2">
            {message.parts.map((part, i) => {
              if (part.type === "text") {
                return message.role === "assistant" ? (
                  <OracleLine key={i}>{part.text}</OracleLine>
                ) : (
                  <UserLine key={i}>{part.text}</UserLine>
                );
              }
              if (
                part.type === "tool-showPalette" &&
                (part.state === "input-available" ||
                  part.state === "output-available") &&
                part.input
              ) {
                return (
                  <PaletteCard
                    key={i}
                    filmId={part.input.filmId}
                    promptText={part.input.promptText}
                  />
                );
              }
              return null;
            })}
          </div>
        ))}

        {status === "submitted" && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Spinner className="size-3" />
            <span className="text-sm italic">the oracle considers…</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 border-t border-border pt-4"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) handleSubmit(e);
          }}
          rows={1}
          placeholder="Speak plainly…"
          className="max-h-40 min-h-10 flex-1 resize-none rounded-2xl border border-input bg-muted/30 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-3 focus:ring-ring/30"
        />
        <Button type="submit" disabled={busy || !text.trim()} className="h-10 px-5">
          Send
        </Button>
      </form>
    </div>
  );
}

function OracleLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[90%]">
      <p className="text-lg italic leading-relaxed text-foreground/90">
        {children}
      </p>
    </div>
  );
}

function UserLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="ml-auto max-w-[80%] rounded-2xl bg-muted px-4 py-2.5">
      <p className="text-sm text-foreground/90">{children}</p>
    </div>
  );
}
