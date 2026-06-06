"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { OracleUIMessage } from "@/lib/oracle-tools";
import type { ExperienceProfile } from "@/lib/types";
import { setActiveOraclePersonaId } from "@/lib/oracle-chat-persona";
import { oracleChatTransport } from "@/lib/oracle-chat-transport";
import {
  DEFAULT_PERSONA_ID,
  getOraclePersona,
  type OraclePersonaId,
} from "@/lib/oracle-personas";

export type OracleChatStatus = "ready" | "submitted" | "streaming" | "error";

/** @deprecated Use persona-specific opening lines from oracle-personas. */
export const ORACLE_OPENING_LINE = getOraclePersona(
  DEFAULT_PERSONA_ID,
).openingLine;

export function useOracleChat(
  onFinalize: (profile: ExperienceProfile) => void,
  personaId: OraclePersonaId = DEFAULT_PERSONA_ID,
) {
  useEffect(() => {
    setActiveOraclePersonaId(personaId);
  }, [personaId]);

  const { messages, sendMessage, status, error, clearError } =
    useChat<OracleUIMessage>({
      transport: oracleChatTransport,
      onError: (err) => {
        console.error("[oracle-chat]", err);
      },
    });

  const [text, setText] = useState("");
  const finalized = useRef(false);

  useEffect(() => {
    finalized.current = false;
  }, [personaId]);

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

  const openingLine = getOraclePersona(personaId).openingLine;

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
    openingLine,
  };
}
