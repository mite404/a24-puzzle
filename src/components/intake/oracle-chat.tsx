"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { OracleUIMessage } from "@/lib/oracle-tools";
import type { ExperienceProfile } from "@/lib/types";
import { PaletteCard } from "@/components/intake/palette-card";
import { A24CtaButton } from "@/components/a24-cta-button";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatChatError } from "@/lib/chat-errors";

const OPENING_LINE =
  "Sit with me a moment. Tell me how today actually feels — and which films, directors, or faces you keep circling back to lately.";

interface OracleChatProps {
  onFinalize: (profile: ExperienceProfile) => void;
}

export function OracleChat({ onFinalize }: OracleChatProps) {
  const { messages, sendMessage, status, error, clearError } =
    useChat<OracleUIMessage>({
      onError: (err) => {
        console.error("[oracle-chat]", err);
      },
    });
  const [text, setText] = useState("");
  const finalized = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastStatus = useRef(status);

  useEffect(() => {
    if (lastStatus.current === status) return;
    console.log("[oracle-chat] status", { from: lastStatus.current, to: status });
    lastStatus.current = status;
  }, [status]);

  useEffect(() => {
    if (messages.length === 0) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages]);

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

  const assistantStreamingText = useMemo(() => {
    if (status !== "streaming") return false;
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return false;
    return lastAssistant.parts.some(
      (p) => p.type === "text" && p.text.trim().length > 0,
    );
  }, [messages, status]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    console.log("[oracle-chat] send", {
      length: trimmed.length,
      hint: "Watch the dev server terminal for [openrouter] logs.",
    });
    sendMessage({ text: trimmed });
    setText("");
  }

  return (
    <div className="flex h-full w-full flex-col">
      <header className="mb-10">
        <p className="a24-meta">Consultation</p>
        <h1 className="a24-title mt-3 max-w-[14ch]">The Oracle</h1>
      </header>

      {error && (
        <ChatErrorBanner
          message={formatChatError(error)}
          onDismiss={clearError}
        />
      )}

      <div className="flex flex-1 flex-col gap-6 overflow-y-auto">
        <OracleLine>{OPENING_LINE}</OracleLine>

        {messages.map((message) => (
          <div key={message.id} className="flex flex-col gap-3">
            {message.parts.map((part, i) => {
              if (part.type === "text") {
                return message.role === "assistant" ? (
                  <OracleLine key={i}>{part.text}</OracleLine>
                ) : (
                  <UserLine key={i}>{part.text}</UserLine>
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
                  const toolError =
                    part.state === "output-error"
                      ? part.errorText
                      : "error" in (part.output as object)
                        ? String((part.output as { error?: string }).error)
                        : "Palette could not be shown.";
                  return (
                    <ToolErrorLine key={i} message={toolError} />
                  );
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
                    />
                  );
                }
              }
              return null;
            })}
          </div>
        ))}

        <OracleStatusLine
          status={status}
          modelResponding={assistantStreamingText}
        />
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-10 flex flex-col gap-4 border-t border-foreground pt-6"
      >
        <p className="a24-meta">Your reply</p>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) handleSubmit(e);
            }}
            rows={2}
            placeholder="Speak plainly…"
            disabled={busy}
            aria-describedby="oracle-compose-status"
            className="a24-prose min-h-12 flex-1 resize-none rounded-none border border-foreground bg-transparent px-3 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-foreground disabled:opacity-60"
          />
          <A24CtaButton
            type="submit"
            disabled={busy || !text.trim()}
            className="shrink-0 self-start sm:self-end"
          >
            Send
          </A24CtaButton>
        </div>
        <ComposeStatusLine status={status} modelResponding={assistantStreamingText} />
      </form>
    </div>
  );
}

function OracleLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="a24-prose">
      <p>{children}</p>
    </div>
  );
}

function UserLine({ children }: { children: React.ReactNode }) {
  return (
    <div className="a24-prose max-w-none border border-foreground px-4 py-3 sm:ms-auto sm:max-w-[var(--a24-copy-max)]">
      <p>{children}</p>
    </div>
  );
}

function ChatErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="mb-6 border border-destructive/40 bg-destructive/5 px-4 py-3"
    >
      <p className="a24-eyebrow text-destructive">Oracle unavailable</p>
      <p className="a24-prose mt-2 text-sm text-destructive/90">{message}</p>
      <Button
        type="button"
        variant="outline"
        onClick={onDismiss}
        className="mt-3 h-8 rounded-none px-3 text-xs uppercase"
      >
        Dismiss
      </Button>
    </div>
  );
}

function ToolErrorLine({ message }: { message: string }) {
  return (
    <p className="a24-prose text-sm text-destructive" role="status">
      {message}
    </p>
  );
}

type ChatStatus = "ready" | "submitted" | "streaming" | "error";

function OracleStatusLine({
  status,
  modelResponding,
}: {
  status: ChatStatus;
  modelResponding: boolean;
}) {
  if (status === "ready" || status === "error") return null;

  const label =
    status === "submitted"
      ? "Your message reached the oracle. Waiting for the model…"
      : modelResponding
        ? "The oracle is responding…"
        : "The model is thinking — this can take a moment.";

  return (
    <div
      className="a24-prose flex items-center gap-2 text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      <Spinner className="size-3 shrink-0" aria-hidden />
      <span className="italic">{label}</span>
    </div>
  );
}

function ComposeStatusLine({
  status,
  modelResponding,
}: {
  status: ChatStatus;
  modelResponding: boolean;
}) {
  if (status === "ready") return null;

  const label =
    status === "submitted"
      ? "Sent — delivered to the oracle. Awaiting the first word."
      : modelResponding
        ? "Reply in progress."
        : "The oracle is thinking — this can take a moment.";

  return (
    <p
      id="oracle-compose-status"
      className="a24-eyebrow text-muted-foreground"
      role="status"
      aria-live="polite"
    >
      {label}
    </p>
  );
}
