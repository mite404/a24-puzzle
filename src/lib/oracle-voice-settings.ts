import type { OraclePersonaId } from "@/lib/oracle-personas";
import type { VocalEmotionResult } from "@/lib/valence";

/** ElevenLabs `voice_settings` fields accepted by `/api/voice`. */
export interface OracleVoiceSettings {
  stability: number;
  similarity_boost: number;
  style?: number;
  speed?: number;
  use_speaker_boost?: boolean;
}

interface VoiceSettingsAdjustment {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  speed?: number;
}

const PERSONA_BASELINES: Record<OraclePersonaId, OracleVoiceSettings> = {
  ladybird_mom: {
    stability: 0.45,
    similarity_boost: 0.75,
    speed: 1.0,
    use_speaker_boost: true,
  },
  witch: {
    stability: 0.65,
    similarity_boost: 0.7,
    speed: 0.95,
    use_speaker_boost: true,
  },
  materialist: {
    stability: 0.5,
    similarity_boost: 0.75,
    speed: 1.02,
    style: 0.1,
    use_speaker_boost: true,
  },
};

/** Shared emotion deltas applied on top of each persona baseline. */
const EMOTION_ADJUSTMENTS: Record<string, VoiceSettingsAdjustment> = {
  sad: {
    stability: -0.12,
    similarity_boost: 0.05,
    speed: -0.06,
  },
  irritated: {
    stability: 0.1,
    speed: -0.02,
  },
  angry: {
    stability: 0.12,
    speed: -0.03,
  },
  happy: {
    stability: -0.08,
    speed: 0.04,
  },
  excited: {
    stability: -0.1,
    speed: 0.06,
    style: 0.1,
  },
};

/** Persona-specific tweaks so characters stay in-world under each tone. */
const PERSONA_EMOTION_OVERRIDES: Partial<
  Record<OraclePersonaId, Partial<Record<string, VoiceSettingsAdjustment>>>
> = {
  ladybird_mom: {
    sad: { stability: -0.05, speed: -0.02 },
    irritated: { stability: 0.05 },
  },
  witch: {
    irritated: { stability: 0.08 },
    angry: { stability: 0.06 },
    sad: { stability: -0.06, speed: -0.04 },
  },
  materialist: {
    excited: { style: 0.12, speed: 0.03 },
    happy: { style: 0.06, speed: 0.02 },
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function applyAdjustment(
  base: OracleVoiceSettings,
  adjustment: VoiceSettingsAdjustment,
): OracleVoiceSettings {
  return {
    stability: clamp(
      base.stability + (adjustment.stability ?? 0),
      0,
      1,
    ),
    similarity_boost: clamp(
      base.similarity_boost + (adjustment.similarity_boost ?? 0),
      0,
      1,
    ),
    style:
      adjustment.style !== undefined || base.style !== undefined
        ? clamp((base.style ?? 0) + (adjustment.style ?? 0), 0, 1)
        : undefined,
    speed:
      adjustment.speed !== undefined || base.speed !== undefined
        ? clamp((base.speed ?? 1) + (adjustment.speed ?? 0), 0.7, 1.2)
        : undefined,
    use_speaker_boost: base.use_speaker_boost,
  };
}

function mergeAdjustments(
  ...adjustments: Array<VoiceSettingsAdjustment | undefined>
): VoiceSettingsAdjustment {
  return adjustments.reduce<VoiceSettingsAdjustment>(
    (merged, adjustment) => {
      if (!adjustment) return merged;
      return {
        stability: (merged.stability ?? 0) + (adjustment.stability ?? 0),
        similarity_boost:
          (merged.similarity_boost ?? 0) + (adjustment.similarity_boost ?? 0),
        style: (merged.style ?? 0) + (adjustment.style ?? 0),
        speed: (merged.speed ?? 0) + (adjustment.speed ?? 0),
      };
    },
    {},
  );
}

/**
 * Map persona baseline + user's detected vocal tone to ElevenLabs voice_settings.
 * Fail-open: missing, neutral, or low-confidence emotion → persona baseline only.
 */
export function resolveOracleVoiceSettings(
  personaId: OraclePersonaId,
  vocalEmotion?: VocalEmotionResult | null,
): OracleVoiceSettings {
  const baseline = PERSONA_BASELINES[personaId];

  const emotion = vocalEmotion?.emotion?.trim().toLowerCase();
  if (!emotion || emotion === "neutral") {
    return { ...baseline };
  }

  const shared = EMOTION_ADJUSTMENTS[emotion];
  const personaSpecific = PERSONA_EMOTION_OVERRIDES[personaId]?.[emotion];
  const adjustment = mergeAdjustments(shared, personaSpecific);

  if (
    adjustment.stability === undefined &&
    adjustment.similarity_boost === undefined &&
    adjustment.style === undefined &&
    adjustment.speed === undefined
  ) {
    return { ...baseline };
  }

  return applyAdjustment(baseline, adjustment);
}
