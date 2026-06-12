import { DEBUG_EXPERIENCE_ENABLED } from "@/lib/debug-experience";

const DEBUG_VOICE_OFF_STORAGE_KEY = "a24-debug-voice-off";

export const DEBUG_VOICE_CHANGE_EVENT = "a24-debug-voice-change";

/** Whether ElevenLabs TTS, Scribe, and Valence calls are allowed (dev toggle). */
export function areVoiceApisEnabled(): boolean {
  if (!DEBUG_EXPERIENCE_ENABLED) return true;
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(DEBUG_VOICE_OFF_STORAGE_KEY) !== "1";
}

export function readDebugVoiceOff(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DEBUG_VOICE_OFF_STORAGE_KEY) === "1";
}

export function writeDebugVoiceOff(off: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEBUG_VOICE_OFF_STORAGE_KEY, off ? "1" : "0");
  window.dispatchEvent(
    new CustomEvent(DEBUG_VOICE_CHANGE_EVENT, { detail: off }),
  );
}
