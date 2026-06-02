import type { Scores } from "@/lib/types";

export interface FanTier {
  title: string;
  blurb: string;
}

/** Maps an overall correctness ratio to an A24 fan tier. */
export function fanTier(scores: Scores): FanTier {
  const total = scores.locationTotal + scores.crosswordTotal;
  const correct = scores.location + scores.crossword;
  const ratio = total === 0 ? 0 : correct / total;

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
