"use client";

import type { ExperienceProfile } from "@/lib/types";
import { OracleTvScene } from "@/components/intake/oracle-tv-scene";

interface OracleChatProps {
  onFinalize: (profile: ExperienceProfile) => void;
}

/** @deprecated Use OracleTvScene — kept for imports that expect OracleChat. */
export function OracleChat({ onFinalize }: OracleChatProps) {
  return <OracleTvScene onFinalize={onFinalize} />;
}

export { ORACLE_OPENING_LINE, useOracleChat } from "@/hooks/use-oracle-chat";
