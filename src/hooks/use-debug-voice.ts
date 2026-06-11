"use client";

import { useCallback, useEffect, useState } from "react";
import { DEBUG_EXPERIENCE_ENABLED } from "@/lib/debug-experience";
import {
  DEBUG_VOICE_CHANGE_EVENT,
  readDebugVoiceOff,
  writeDebugVoiceOff,
} from "@/lib/debug-voice";

/** Dev-only toggle for ElevenLabs + Valence API calls. */
export function useDebugVoice() {
  const [voiceOff, setVoiceOff] = useState(false);

  useEffect(() => {
    if (!DEBUG_EXPERIENCE_ENABLED) return;
    setVoiceOff(readDebugVoiceOff());

    function onChange(event: Event) {
      setVoiceOff((event as CustomEvent<boolean>).detail);
    }

    window.addEventListener(DEBUG_VOICE_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(DEBUG_VOICE_CHANGE_EVENT, onChange);
  }, []);

  const toggleVoiceOff = useCallback(() => {
    const next = !readDebugVoiceOff();
    writeDebugVoiceOff(next);
    setVoiceOff(next);
  }, []);

  return {
    voiceOff,
    voiceApisEnabled: !voiceOff,
    toggleVoiceOff,
  };
}
