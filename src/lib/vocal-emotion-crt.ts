/**
 * Diegetic CRT tone modifiers — maps Valence emotions to CSS class names.
 * Never surfaced as raw labels in the UI.
 */
export function crtToneClassForEmotion(emotion: string | undefined): string {
  if (!emotion) return "";

  switch (emotion.toLowerCase()) {
    case "irritated":
    case "angry":
      return "crt-tone-agitated";
    case "sad":
      return "crt-tone-sad";
    case "happy":
    case "excited":
      return "crt-tone-warm";
    default:
      return "";
  }
}
