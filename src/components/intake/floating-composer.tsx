"use client";

import { MicIcon } from "lucide-react";
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
  scribeError?: string | null;
  onDismissScribeError?: () => void;
  micListening?: boolean;
  micConnecting?: boolean;
  micDisabled?: boolean;
  onMicToggle?: () => void;
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
  scribeError,
  onDismissScribeError,
  micListening = false,
  micConnecting = false,
  micDisabled = false,
  onMicToggle,
  channelLabel,
}: FloatingComposerProps) {
  const audioError = voiceError ?? scribeError;
  const dismissAudioError = voiceError
    ? onDismissVoiceError
    : onDismissScribeError;
  const micActive = micListening || micConnecting;
  const micLabel = micListening
    ? "Stop and send"
    : micConnecting
      ? "Connecting mic…"
      : "Speak to the oracle";

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

        {audioError ? (
          <div
            role="status"
            className="oracle-tv-composer__error mb-3 flex items-start justify-between gap-4 px-1"
          >
            <p className="text-xs leading-snug text-[#ffb4a8]/80">
              {voiceError ? `Voice: ${voiceError}` : `Mic: ${scribeError}`}
            </p>
            {dismissAudioError ? (
              <button
                type="button"
                onClick={dismissAudioError}
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
            className={`oracle-tv-composer__input min-h-11 flex-1 resize-none bg-transparent text-[#f5e6c8] placeholder:text-[#f5e6c8]/35 focus:outline-none disabled:opacity-50${micListening ? " oracle-tv-composer__input--listening" : ""}`}
          />
          <div className="oracle-tv-composer__actions flex shrink-0 items-center gap-3">
            {onMicToggle ? (
              <button
                type="button"
                onClick={onMicToggle}
                disabled={micDisabled}
                aria-pressed={micListening}
                aria-label={micLabel}
                title={micLabel}
                className={`oracle-tv-composer__mic inline-flex size-10 items-center justify-center rounded-full border border-[#f5e6c8]/20 text-[#f5e6c8]/80 transition-colors hover:border-[#9dff9d]/40 hover:text-[#9dff9d] disabled:cursor-not-allowed disabled:opacity-40${micListening ? " oracle-tv-composer__mic--listening" : ""}${micConnecting ? " oracle-tv-composer__mic--connecting" : ""}`}
              >
                {micConnecting ? (
                  <Spinner
                    className="size-4 text-[#9dff9d]/80"
                    aria-hidden
                  />
                ) : (
                  <MicIcon className="size-4" aria-hidden />
                )}
              </button>
            ) : null}
            <A24CtaButton
              type="submit"
              disabled={busy || !text.trim() || micActive}
              className="oracle-tv-composer__send shrink-0 text-[#f5e6c8] disabled:opacity-40"
            >
              Send
            </A24CtaButton>
          </div>
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
