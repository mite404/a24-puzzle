"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEBUG_EXPERIENCE_ENABLED } from "@/lib/debug-experience";
import {
  DEBUG_VOICE_CHANGE_EVENT,
  readDebugVoiceOff,
  writeDebugVoiceOff,
} from "@/lib/debug-voice";

/**
 * The voice-off flag lives in localStorage and changes via a window event, so it is
 * an external store. `useSyncExternalStore` reads it without a setState-in-effect,
 * and returns the SSR-safe `false` on the server (no `window`).
 */
function subscribe(onStoreChange: () => void): () => void {
  if (!DEBUG_EXPERIENCE_ENABLED) return () => {};
  window.addEventListener(DEBUG_VOICE_CHANGE_EVENT, onStoreChange);
  return () => window.removeEventListener(DEBUG_VOICE_CHANGE_EVENT, onStoreChange);
}

function getSnapshot(): boolean {
  return DEBUG_EXPERIENCE_ENABLED ? readDebugVoiceOff() : false;
}

/** Dev-only toggle for ElevenLabs + Valence API calls. */
export function useDebugVoice() {
  const voiceOff = useSyncExternalStore(subscribe, getSnapshot, () => false);

  const toggleVoiceOff = useCallback(() => {
    // writeDebugVoiceOff dispatches DEBUG_VOICE_CHANGE_EVENT, which the store
    // subscription above picks up to re-render.
    writeDebugVoiceOff(!readDebugVoiceOff());
  }, []);

  return {
    voiceOff,
    voiceApisEnabled: !voiceOff,
    toggleVoiceOff,
  };
}
