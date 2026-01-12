// lib/validators.ts
export const ALLOWED_MOODS = [
  "joyful",
  "happy",
  "calm",
  "neutral",
  "tired",
  "sad",
  "anxious",
  "stressed",
  "frustrated",
  "angry",
] as const;
export type MoodLabel = typeof ALLOWED_MOODS[number];

export const ALLOWED_CATEGORIES = [
  "personal",
  "relationships",
  "health",
  "habits",
  "work",
  "study",
  "creativity",
  "goals",
  "reflection",
  "finance",
  "daily",
  "other",
] as const;
export type CategoryLabel = typeof ALLOWED_CATEGORIES[number];

export function isValidMood(m: any): m is MoodLabel {
  return typeof m === "string" && (ALLOWED_MOODS as readonly string[]).includes(m);
}
export function isValidCategory(c: any): c is CategoryLabel {
  return typeof c === "string" && (ALLOWED_CATEGORIES as readonly string[]).includes(c);
}

export function sanitizeMood(m: any): MoodLabel | null {
  if (m === undefined || m === null) return null;
  if (isValidMood(m)) return m as MoodLabel;
  if (typeof m === "string") {
    const low = m.toLowerCase().trim();
    // direct match after lowercase
    if (isValidMood(low)) return low as MoodLabel;
    // try normalization (english + synonyms)
    const normalized = normalizeMoodFreeform(low);
    if (normalized) return normalized;
  }
  return null;
}

export function sanitizeCategory(c: any): CategoryLabel | null {
  if (c === undefined || c === null) return null;
  if (isValidCategory(c)) return c as CategoryLabel;
  if (typeof c === "string") {
    const low = c.toLowerCase().trim();
    if (isValidCategory(low)) return low as CategoryLabel;
    const normalized = normalizeCategoryFreeform(low);
    if (normalized) return normalized;
  }
  return null;
}

/**
 * Optional synonym mapping for freeform LLM outputs.
 * Add more mappings if you see common model synonyms.
 */
const MOOD_SYNONYMS: Record<string, MoodLabel> = {
  // english synonyms
  happiness: "happy",
  joy: "joyful",
  joyful: "joyful",
  happy: "happy",
  tiredness: "tired",
  anxiousness: "anxious",
  anxiety: "anxious",
  angry: "angry",
  frustration: "frustrated",
  frustrated: "frustrated",
  stressed: "stressed",
  calm: "calm",
  neutral: "neutral",
  sad: "sad",

  // Indonesian synonyms
  senang: "happy",
  bahagia: "happy",
  gembira: "joyful",
  capek: "tired",
  lelah: "tired",
  sedih: "sad",
  cemas: "anxious",
  khawatir: "anxious",
  marah: "angry",
  frustasi: "frustrated",
  stres: "stressed",
  tenang: "calm",
  netral: "neutral",
};

export function normalizeMoodFreeform(s: string | null | undefined): MoodLabel | null {
  if (!s) return null;
  const low = String(s).toLowerCase().trim();
  if (isValidMood(low)) return low as MoodLabel;
  if (MOOD_SYNONYMS[low]) return MOOD_SYNONYMS[low];
  // sometimes model returns extra punctuation or parentheses, try strip non-alpha
  const cleaned = low.replace(/[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s]/g, "").trim();
  if (MOOD_SYNONYMS[cleaned]) return MOOD_SYNONYMS[cleaned];
  return null;
}

/**
 * Category synonyms mapping (English + Indonesian)
 */
const CATEGORY_SYNONYMS: Record<string, CategoryLabel> = {
  // english synonyms
  personal: "personal",
  relationship: "relationships",
  relationships: "relationships",
  health: "health",
  fitness: "health",
  habits: "habits",
  work: "work",
  study: "study",
  studying: "study",
  creativity: "creativity",
  goal: "goals",
  goals: "goals",
  reflection: "reflection",
  finance: "finance",
  daily: "daily",
  other: "other",

  // Indonesian
  personalia: "personal",
  keluarga: "relationships",
  hubungan: "relationships",
  kesehatan: "health",
  kebiasaan: "habits",
  kerja: "work",
  pekerjaan: "work",
  belajar: "study",
  kreatif: "creativity",
  tujuan: "goals",
  refleksi: "reflection",
  keuangan: "finance",
  harian: "daily",
  lain: "other",
  "lain-lain": "other",
};

export function normalizeCategoryFreeform(s: string | null | undefined): CategoryLabel | null {
  if (!s) return null;
  const low = String(s).toLowerCase().trim();
  if (isValidCategory(low)) return low as CategoryLabel;
  if (CATEGORY_SYNONYMS[low]) return CATEGORY_SYNONYMS[low];
  const cleaned = low.replace(/[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\s-]/g, "").trim();
  if (CATEGORY_SYNONYMS[cleaned]) return CATEGORY_SYNONYMS[cleaned];
  return null;
}
