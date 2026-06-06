"use client";

import { Spinner } from "@/components/ui/spinner";
import { A24CtaButton } from "@/components/a24-cta-button";
import { formatChatError } from "@/lib/chat-errors";
import type { OracleChatStatus } from "@/hooks/use-oracle-chat";

interface FloatingComposerProps {
  text: string;
  onTextChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  busy: boolean;
  status: OracleChatStatus;
  modelResponding: boolean;
  error: Error | undefined;
  onDismissError: () => void;
  voiceError?: string | null;
  onDismissVoiceError?: () => void;
  channelLabel?: string;
}

export function FloatingComposer({
  text,
  onTextChange,
  onSubmit,
  busy,
  status,
  modelResponding,
  error,
  onDismissError,
  voiceError,
  onDismissVoiceError,
  channelLabel,
}: FloatingComposerProps) {
  return (
    <div className="oracle-tv-composer pointer-events-none absolute inset-x-0 bottom-0 z-30">
      <div className="oracle-tv-composer__inner pointer-events-auto">
        {channelLabel ? (
          <p className="oracle-tv-composer__channel mb-2 text-[0.625rem] uppercase tracking-[0.14em] text-[#f5e6c8]/40">
            {channelLabel}
          </p>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="oracle-tv-composer__error mb-3 flex items-start justify-between gap-4 px-1"
          >
            <p className="text-xs leading-snug text-[#ffb4a8]">
              {formatChatError(error)}
            </p>
            <button
              type="button"
              onClick={onDismissError}
              className="shrink-0 text-[0.625rem] uppercase tracking-widest text-[#ffb4a8]/80 hover:text-[#ffb4a8]"
            >
              Dismiss
            </button>
          </div>
        ) : null}

        {voiceError ? (
          <div
            role="status"
            className="oracle-tv-composer__error mb-3 flex items-start justify-between gap-4 px-1"
          >
            <p className="text-xs leading-snug text-[#ffb4a8]/80">
              Voice: {voiceError}
            </p>
            {onDismissVoiceError ? (
              <button
                type="button"
                onClick={onDismissVoiceError}
                className="shrink-0 text-[0.625rem] uppercase tracking-widest text-[#ffb4a8]/60 hover:text-[#ffb4a8]"
              >
                Dismiss
              </button>
            ) : null}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="oracle-tv-composer__form">
          <textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) onSubmit(e);
            }}
            rows={2}
            placeholder="Speak from the couch…"
            disabled={busy}
            aria-describedby="oracle-tv-compose-status"
            className="oracle-tv-composer__input min-h-11 flex-1 resize-none bg-transparent text-[#f5e6c8] placeholder:text-[#f5e6c8]/35 focus:outline-none disabled:opacity-50"
          />
          <A24CtaButton
            type="submit"
            disabled={busy || !text.trim()}
            className="oracle-tv-composer__send shrink-0 text-[#f5e6c8] disabled:opacity-40"
          >
            Send
          </A24CtaButton>
        </form>

        <ComposeStatus
          status={status}
          modelResponding={modelResponding}
        />
      </div>
    </div>
  );
}

function ComposeStatus({
  status,
  modelResponding,
}: {
  status: OracleChatStatus;
  modelResponding: boolean;
}) {
  if (status === "ready") return null;

  const label =
    status === "submitted"
      ? "Signal sent — waiting for the set."
      : modelResponding
        ? "On air."
        : "Tuning in…";

  return (
    <p
      id="oracle-tv-compose-status"
      className="oracle-tv-composer__status mt-2 flex items-center gap-2 text-[0.625rem] uppercase tracking-[0.14em] text-[#f5e6c8]/45"
      role="status"
      aria-live="polite"
    >
      <Spinner className="size-2.5 shrink-0 text-[#9dff9d]/70" aria-hidden />
      {label}
    </p>
  );
}
