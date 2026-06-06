import {
  DEFAULT_PERSONA_ID,
  type OraclePersonaId,
} from "@/lib/oracle-personas";

/**
 * Latest dial-selected persona for the chat transport. Updated from
 * OracleTvScene on channel change so mid-conversation switches keep history
 * without recreating DefaultChatTransport (and tripping react-hooks/refs).
 */
let activePersonaId: OraclePersonaId = DEFAULT_PERSONA_ID;

export function setActiveOraclePersonaId(id: OraclePersonaId): void {
  activePersonaId = id;
}

export function getActiveOraclePersonaId(): OraclePersonaId {
  return activePersonaId;
}
