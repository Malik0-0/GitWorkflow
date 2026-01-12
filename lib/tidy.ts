// lib/tidy.ts
import { normalizeMoodFreeform, sanitizeMood, sanitizeCategory } from "./validators";

const DEFAULT_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

function safeJsonParse(output: string) {
  try { return JSON.parse(output); } catch {
    const block = output.match(/\{[\s\S]*\}/);
    try { return block ? JSON.parse(block[0]) : {}; } catch { return {}; }
  }
}

function firstWords(s: string, n = 6) {
  return s.split(/\s+/).filter(Boolean).slice(0, n).join(" ");
}

function parseDateCandidate(dateStr: any): Date | null {
  if (!dateStr) return null;
  try {
    const d = new Date(String(dateStr));
    if (!isNaN(d.getTime())) return d;
  } catch { }
  return null;
}

export type TidyEntry = {
  title: string | null;
  contentTidied: string;
  moodLabel: string | null;
  moodScore: number | null;
  category: string | null;
  dateCandidate: Date | null;
  rawAI?: string;
  parsed?: any;
};

function geminiUrl(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

async function callGeminiGenerate(model: string, apiKey: string, systemPrompt: string, userText: string) {
  if (!apiKey) throw new Error("Missing GEMINI API key");

  // We send two content entries: system (instructions) and user (the actual text)
  const payload = {
    contents: [
      { parts: [{ text: systemPrompt }] },
      { parts: [{ text: userText }] },
    ],
    // You can add optional settings here later (e.g., temperature, candidateCount)
  };

  const url = geminiUrl(model);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();

  if (!res.ok) {
    // Surface detailed message for debugging
    throw new Error(`Gemini generate error ${res.status}: ${text}`);
  }

  // Parse canonical text from typical Gemini response shapes
  try {
    const j = JSON.parse(text);
    const candidate = Array.isArray(j?.candidates) ? j.candidates[0] : null;
    const parts = candidate?.content?.parts ?? j?.candidates?.[0]?.content?.parts;

    if (parts && Array.isArray(parts) && typeof parts[0]?.text === "string") {
      // join parts if model returned multiple parts
      return { raw: text, text: parts.map((p: any) => String(p.text)).join("\n"), json: j };
    }

    // fallback top-level shapes
    if (typeof j?.output?.text === "string") return { raw: text, text: j.output.text, json: j };
    if (typeof j?.text === "string") return { raw: text, text: j.text, json: j };

    return { raw: text, text: text, json: j };
  } catch (err) {
    // not JSON — return raw
    return { raw: text, text, json: null };
  }
}

export async function runTidyModel(opts: {
  text: string;
  entry?: any | null;
  userOverrides?: {
    title?: string | null;
    moodLabel?: string | null;
    moodScore?: number | null;
    category?: string | null;
    date?: string | null;
  };
  hfToken?: string; // here hfToken is treated as Gemini API key if provided
}): Promise<TidyEntry> {
  const { text, entry, userOverrides = {}, hfToken = process.env.GEMINI_TOKEN } = opts;
  if (!text || typeof text !== "string" || text.trim() === "") {
    throw new Error("Empty text for tidy");
  }
  if (!hfToken) throw new Error("Missing GEMINI_TOKEN");

  const manualOverrides: Record<string, any> = {
    title: entry?.titleManual ? (entry?.titleRaw ?? "") : null,
    moodLabel: entry?.moodManual ? entry?.moodLabel ?? null : null,
    moodScore: entry?.moodManual ? entry?.moodScore ?? null : null,
    category: entry?.categoryManual ? entry?.category ?? null : null,
    date: entry?.dateManual ? (entry?.dayDate ? (entry.dayDate instanceof Date ? entry.dayDate.toISOString().slice(0, 10) : new Date(entry.dayDate).toISOString().slice(0, 10)) : null) : null,
  };

  const userProvided = {
    title: userOverrides.title ?? null,
    moodLabel: userOverrides.moodLabel ?? null,
    moodScore: userOverrides.moodScore ?? null,
    category: userOverrides.category ?? null,
    date: userOverrides.date ?? null,
  };

  for (const k of Object.keys(userProvided)) {
    if (userProvided[k as keyof typeof userProvided] != null) {
      manualOverrides[k] = userProvided[k as keyof typeof userProvided];
    }
  }

  // IMPORTANT: updated prompt — explicitly forbid inventing dates.
  // If no explicit date expressed in the user text, return an empty string for `date`.
  // This reduces hallucinated/past dates.
  const systemPrompt = `
Return ONLY JSON. No explanation.
If a field in "userOverrides" is NOT null, DO NOT modify it.

userOverrides:
${JSON.stringify(manualOverrides, null, 2)}

Strict Rules:
- Use the same language as what user frequently type in all other note or currently used (this is a must, that cant be left out)

Rules:
- Always rewrite content into a clearer, refined version.
- If override is null → AI must infer it.
- title: short, max 8 words.
- moodLabel: one of joyful, happy, calm, neutral, tired, sad, anxious, stressed, frustrated, angry
- moodScore: float 1.0–10.0
- category: personal, relationships, health, habits, work, study, creativity, goals, reflection, finance, daily, other
- If any harsh word, change it more sweet

IMPORTANT date rules:
- **Do NOT invent or guess a specific date.**
- Return date **only** if the user explicitly provided a date or a clear time reference (e.g. "yesterday", "14 April 2025").
- **If no explicit date/time is present, return an empty string for date.**

Response shape:
{ "title": "...", "content": "...", "moodLabel": "...", "moodScore": 5.0, "category": "...", "date": "YYYY-MM-DD" }
If date is unknown, send: "date": "" 
`.trim();

  // call Gemini generateContent
  const modelToUse = process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const aiResp = await callGeminiGenerate(modelToUse, hfToken, systemPrompt, text);
  const aiOutput = (aiResp?.text ?? "").trim();
  const parsed = safeJsonParse(aiResp?.text ?? aiResp?.raw ?? "");

  const fallbackTitle = ((): string | null => {
    if (manualOverrides.title) return manualOverrides.title;
    if (parsed.title && String(parsed.title).trim()) return String(parsed.title).trim();
    const short = firstWords(text, 6);
    return short || null;
  })();

  const fallbackContent = ((): string => {
    if (parsed.content && String(parsed.content).trim()) return String(parsed.content).trim();
    if (parsed.text && String(parsed.text).trim()) return String(parsed.text).trim();
    return text;
  })();

  const modelRawMood = (parsed.moodLabel ?? parsed.mood ?? null) as string | null;
  const predictedMood = normalizeMoodFreeform(modelRawMood) ?? sanitizeMood(modelRawMood);

  const modelRawCategory = (parsed.category ?? parsed.tags ?? null) as string | null;
  const predictedCategory = sanitizeCategory(modelRawCategory);

  let predictedMoodScore: number | null = null;
  const ms = parsed.moodScore ?? parsed.mood_score ?? null;
  if (ms != null) {
    const n = Number(ms);
    if (Number.isFinite(n)) predictedMoodScore = Math.max(1, Math.min(10, n));
  }

  // parse date but obey the new rule: if parsed.date is empty or falsy -> treat as null
  let dateCandidate: Date | null = null;
  if (parsed.date && String(parsed.date).trim() !== "") {
    dateCandidate = parseDateCandidate(parsed.date);
  }
  if (!dateCandidate && userProvided.date) dateCandidate = parseDateCandidate(userProvided.date);
  if (!dateCandidate && manualOverrides.date) dateCandidate = parseDateCandidate(manualOverrides.date);

  const final: TidyEntry = {
    title: fallbackTitle ?? null,
    contentTidied: fallbackContent,
    moodLabel: manualOverrides.moodLabel ?? predictedMood ?? null,
    moodScore: manualOverrides.moodScore ?? (predictedMoodScore ?? null),
    category: manualOverrides.category ?? predictedCategory ?? null,
    dateCandidate: dateCandidate ?? null,
    rawAI: aiResp?.raw ?? aiOutput,
    parsed,
  };

  return final;
}