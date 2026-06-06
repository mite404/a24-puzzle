import type { OraclePersonaId } from "@/lib/oracle-personas";
import type { ScoreQuipTier } from "@/lib/scoring";

export interface PersonaScoreQuips {
  good: string[];
  average: string[];
  bad: string[];
}

export const ORACLE_SCORE_QUIPS: Record<OraclePersonaId, PersonaScoreQuips> = {
  ladybird_mom: {
    good: [
      "Oooh — you're a real A 24 fan. I knew you had it in you.",
      "Okay, fine — you're a real A24 fanboy. Happy now?",
    ],
    average: [
      "I see you're a popcorn aficionado. Nothing wrong with that.",
      "Popcorn aficionado energy. You know the hits, honey.",
    ],
    bad: [
      "I see you're more of a bookworm than a film aficionado.",
      "Bookworm over film buff — but everyone starts somewhere.",
    ],
  },
  witch: {
    good: [
      "Oooh — a true devotee of this house of shadows thou art.",
      "The canon knows thy name, fanboy of the craft.",
    ],
    average: [
      "I see thou art a popcorn aficionado — spectacle before scripture.",
      "Popcorn in hand, not prophecy in heart. Yet thou returnest.",
    ],
    bad: [
      "More bookworm than film aficionado, I see. The reel awaits thee still.",
      "A reader's soul, not a projector's — the path remaineth open.",
    ],
  },
  materialist: {
    good: [
      "Oooh, you're a real A24 fanboy. The data checks out.",
      "Real A24 fanboy credentials. I'd swipe right on that taste.",
    ],
    average: [
      "I see you're a popcorn aficionado. Respectable mid-tier.",
      "Popcorn aficionado — you know the crowd-pleasers, not the deep cuts.",
    ],
    bad: [
      "I see you're more of a bookworm than a film aficionado.",
      "Bookworm over cinephile — but taste can be coached.",
    ],
  },
};

export function pickScoreQuip(
  personaId: OraclePersonaId,
  tier: ScoreQuipTier,
): string {
  const pool = ORACLE_SCORE_QUIPS[personaId][tier];
  return pool[0] ?? "";
}
