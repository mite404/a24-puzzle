"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { OracleUIMessage } from "@/lib/oracle-tools";
import type { ExperienceProfile } from "@/lib/types";

export const ORACLE_OPENING_LINE =
  "Sit with me a moment. Tell me how today actually feels — and which films, directors, or faces you keep circling back to lately.";

export type OracleChatStatus = "ready" | "submitted" | "streaming" | "error";

export function useOracleChat(onFinalize: (profile: ExperienceProfile) => void) {
  const { messages, sendMessage, status, error, clearError } =
    useChat<OracleUIMessage>({
      onError: (err) => {
        console.error("[oracle-chat]", err);
      },
    });
  const [text, setText] = useState("");
  const finalized = useRef(false);

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
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (!lastAssistant) return false;
    return lastAssistant.parts.some(
      (p) => p.type === "text" && p.text.trim().length > 0,
    );
  }, [messages, status]);

  function submit(textOverride?: string) {
    const trimmed = (textOverride ?? text).trim();
    if (!trimmed || busy) return;
    sendMessage({ text: trimmed });
    setText("");
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit();
  }

  return {
    messages,
    text,
    setText,
    status: status as OracleChatStatus,
    error,
    clearError,
    busy,
    assistantStreamingText,
    submit,
    handleSubmit,
  };
}
