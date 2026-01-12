// lib/moodColor.ts

export function moodColorForScore(score: number): string {
  // return CSS color (hex) for slider accentColor or background
  if (score <= 2) return "#FF4D4D"; // angry/frustrated
  if (score <= 4) return "#FF7A3D"; // stressed/anxious
  if (score <= 6) return "#FFD54F"; // neutral/tired
  if (score <= 8) return "#A7E163"; // calm
  return "#6BE37E"; // joyful
}

// map moodLabel -> badge gradient background (solid safe color)
export function moodBadgeColor(label?: string): string {
  switch ((label || "").toLowerCase()) {
    case "joyful":
      return "#FFD54F";
    case "happy":
      return "#FFDD57";
    case "calm":
      return "#A7E163";
    case "neutral":
      return "#9CA3AF";
    case "tired":
      return "#7FB3FF";
    case "sad":
      return "#4C6EF5";
    case "anxious":
      return "#9B5DE5";
    case "stressed":
      return "#FF7A3D";
    case "frustrated":
      return "#FF6B6B";
    case "angry":
      return "#FF4D4D";
    default:
      return "#94A3B8";
  }
}