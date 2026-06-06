"use client";

import { DefaultChatTransport } from "ai";
import type { OracleUIMessage } from "@/lib/oracle-tools";
import { getActiveOraclePersonaId } from "@/lib/oracle-chat-persona";

/** Stable transport instance — persona is read at send time via getActiveOraclePersonaId(). */
export const oracleChatTransport = new DefaultChatTransport<OracleUIMessage>({
  api: "/api/chat",
  prepareSendMessagesRequest: ({ messages, body, ...rest }) => ({
    ...rest,
    body: {
      ...body,
      messages,
      personaId: getActiveOraclePersonaId(),
    },
  }),
});
