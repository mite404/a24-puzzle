import { describe, expect, it } from "bun:test";
import { crosswordBank } from "@/data/crosswordBank";
import type { ExperienceProfile } from "@/lib/types";
import { validateExperienceProfile } from "@/lib/validate-experience";

// Real bank ids, so only the *count* rule is exercised, not the existence rule.
const bankIds = crosswordBank.map((e) => e.id);

function profileWithWordCount(count: number): ExperienceProfile {
  return {
    selectedFilmIds: ["uncut-gems"],
    moods: ["anxious", "electric"],
    crosswordWordIds: bankIds.slice(0, count),
    locationIds: ["ug-diamond-district", "ug-midtown", "ug-les", "br-bushwick"],
  };
}

describe("validateExperienceProfile — crosswordWordIds count", () => {
  // The Phase 2/3 fuzz measured P(>=8 placed) = 100% only once >= 10 ids are
  // requested (92% at 9, 70% at 8). Spec R1 (>= 8 placed) is therefore only
  // reliable at >= 10 requested ids, so the profile must reject fewer.
  it("rejects fewer than 10 crossword word ids", () => {
    const result = validateExperienceProfile(profileWithWordCount(9));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => /crosswordWordIds/.test(e))).toBe(true);
    }
  });

  it("accepts exactly 10 crossword word ids", () => {
    const result = validateExperienceProfile(profileWithWordCount(10));
    expect(result.ok).toBe(true);
  });

  it("accepts 14 crossword word ids", () => {
    const result = validateExperienceProfile(profileWithWordCount(14));
    expect(result.ok).toBe(true);
  });

  it("rejects more than 14 crossword word ids", () => {
    const result = validateExperienceProfile(profileWithWordCount(15));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => /crosswordWordIds/.test(e))).toBe(true);
    }
  });
});
