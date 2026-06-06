import type { Scores } from "@/lib/types";

export interface FanTier {
  title: string;
  blurb: string;
}

/** Voice reaction band for final score (3 tiers, aligned with fanTier ratio bands). */
export type ScoreQuipTier = "good" | "average" | "bad";

function scoreRatio(scores: Scores): number {
  const total = scores.locationTotal + scores.crosswordTotal;
  if (total === 0) return 0;
  return (scores.location + scores.crossword) / total;
}

/** Maps overall score ratio to oracle voice tier: good ≥65%, average ≥40%, else bad. */
export function scoreQuipTier(scores: Scores): ScoreQuipTier {
  const ratio = scoreRatio(scores);
  if (ratio >= 0.65) return "good";
  if (ratio >= 0.4) return "average";
  return "bad";
}

/** Maps an overall correctness ratio to an A24 fan tier. */
export function fanTier(scores: Scores): FanTier {
  const ratio = scoreRatio(scores);

  if (ratio >= 0.9) {
    return {
      title: "A24 Cultist",
      blurb:
        "You don't watch A24 films. You live inside their color grade. Frame this.",
    };
  }
  if (ratio >= 0.65) {
    return {
      title: "Letterboxd Devotee",
      blurb:
        "Four-and-a-half stars, a paragraph of context, and a niche pull quote. Respect.",
    };
  }
  if (ratio >= 0.4) {
    return {
      title: "Arthouse Regular",
      blurb:
        "You know the vibe and most of the canon. The deep cuts are still waiting for you.",
    };
  }
  return {
    title: "Casual Viewer",
    blurb:
      "You came for the tote bag and stayed for the dread. A respectable place to begin.",
  };
}
