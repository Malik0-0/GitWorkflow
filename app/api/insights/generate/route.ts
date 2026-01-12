// app/api/insights/generate/route.ts
import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import prisma from "@/lib/prisma";
import { getEntriesForWeekByCreatedAt, computeWeekMoodStats, buildTextBundleForAI } from "@/lib/insights";

const GEMINI_KEY = process.env.GEMINI_TOKEN;
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

function geminiUrl(model: string) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
}

async function getUserFromToken() {
  const token = await getSessionToken();
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  if (!data?.user) return null;
  return prisma.user.findUnique({ where: { supabaseId: data.user.id } });
}

async function callGemini(prompt: string) {
  if (!GEMINI_KEY) throw new Error("Missing GEMINI_API_KEY (set GEMINI_API_KEY in env)");

  const payload = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    // you can add other model-specific params here if needed
    // e.g. temperature, candidateCount, safetySettings, etc.
  };

  const url = geminiUrl(GEMINI_MODEL);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_KEY,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error(`Gemini error ${res.status}: ${text}`);
  }

  try {
    const j = JSON.parse(text);
    // Typical shape: { candidates: [ { content: { parts: [ { text: "..." } ] } } ] }
    const cand = Array.isArray(j?.candidates) ? j.candidates[0] : null;
    const parts = cand?.content?.parts ?? j?.candidates?.[0]?.content?.parts;

    if (parts && Array.isArray(parts) && typeof parts[0]?.text === "string") {
      return parts.map((p: any) => String(p.text)).join("\n");
    }

    // Some responses may include top-level text
    if (typeof j?.output?.text === "string") return j.output.text;
    if (typeof j?.text === "string") return j.text;

    // fallback: stringify
    return JSON.stringify(j);
  } catch (err) {
    // not JSON - return raw text
    return text;
  }
}

function tryParseJsonFromText(text: string | null): any | null {
  if (!text || typeof text !== "string") return null;
  try { return JSON.parse(text); } catch { }
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) {
    const sub = text.slice(first, last + 1);
    try { return JSON.parse(sub); } catch { }
  }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch { }
  }
  return null;
}

function sanitizeStringCandidate(s?: any): string | null {
  if (!s || typeof s !== "string") return null;
  const trimmed = s.replace(/<[^>]+>/g, "").trim();
  if (!trimmed) return null;
  // if it's just short model tokens like "think" or "ok" or "..." treat as null
  if (/^<*think>*$/i.test(trimmed) || /^ok\b/i.test(trimmed) || /^okay\b/i.test(trimmed) && trimmed.length < 10) return null;
  if (/^<.*>$/.test(trimmed) && trimmed.length < 10) return null;
  return trimmed;
}

function statsToMoodSummary(stats: any) {
  const moodSummary: any = { avgScore: null, mostMood: null, distribution: {} };
  if (!stats) return moodSummary;
  if (typeof stats.avgScore === "number") moodSummary.avgScore = stats.avgScore;
  else if (typeof stats.average === "number") moodSummary.avgScore = stats.average;
  if (stats.mostMood) moodSummary.mostMood = stats.mostMood;
  else if (stats.moodCounts) {
    const entries = Object.entries(stats.moodCounts || {});
    if (entries.length) moodSummary.mostMood = entries.reduce((a: any, b: any) => b[1] > a[1] ? b : a)[0];
  }
  const distSource = stats.distribution ?? stats.moodCounts ?? {};
  for (const [k, v] of Object.entries(distSource)) {
    if (String(k).toLowerCase() === "unknown") continue;
    const n = Number(v as any);
    if (Number.isFinite(n) && n > 0) moodSummary.distribution[String(k)] = n;
  }
  return moodSummary;
}

function fallbackParseToJson(text: string, stats: any) {
  const out: any = {
    summary: null,
    shortSummary: null,
    recommendations: [],
    highlights: [],
    moodSummary: statsToMoodSummary(stats),
  };

  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length) out.summary = paragraphs[0];

  const bullets = text.match(/(?:\n|^)\s*[-•]\s+([^\n]+)/g);
  if (bullets) out.highlights = bullets.map(s => s.replace(/^\s*[-•]\s*/, "").trim()).slice(0, 6);
  else {
    const quoteMatch = text.match(/"(.*?)"/g);
    if (quoteMatch) out.highlights = quoteMatch.map(q => q.replace(/"/g, "")).slice(0, 6);
  }

  const recMatch = text.match(/recommendations?\s*[:\-]\s*([\s\S]*)/i);
  if (recMatch) {
    const recs = recMatch[1].split(/\r?\n/).map(s => s.replace(/^\s*[\d\-\.\)]*\s*/, "").trim()).filter(Boolean);
    out.recommendations = recs.slice(0, 4);
  } else {
    const numbered = text.match(/(?:\n|^)\s*\d+\.\s+([^\n]+)/g);
    if (numbered) out.recommendations = numbered.map(s => s.replace(/^\s*\d+\.\s*/, "").trim()).slice(0, 4);
  }

  if ((!out.moodSummary || !out.moodSummary.distribution) && stats) {
    out.moodSummary = statsToMoodSummary(stats);
  }

  return out;
}

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const weekStart = url.searchParams.get("weekStart");
    if (!weekStart) return NextResponse.json({ error: "weekStart required (YYYY-MM-DD)" }, { status: 400 });

    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { entries, startISO, endISO } = await getEntriesForWeekByCreatedAt(user.id, weekStart);
    const stats = computeWeekMoodStats(entries);
    const bundle = buildTextBundleForAI(entries);

    const prompt = `
Strict Rules:
- Use the same language as what user frequently type in all other note (this is a must, that cant be left out)
- Use FIRST-PERSON voice for 'summary' and 'shortSummary'.
- DO NOT include the key "unknown" in distribution.
- Keep text natural, no inner thoughts or system commentary.
- If data is sparse, write a plausible first-person narrative constrained to given entries (do not invent dates).
- Return ONLY valid JSON object with keys:
  summary, shortSummary, recommendations (array), highlights (array), moodSummary { avgScore, mostMood, distribution }

Data:
${bundle}
`.trim();

    const aiText = (await callGemini(prompt)) ?? "";
    let aiJson: any = tryParseJsonFromText(aiText);

    if (!aiJson) {
      aiJson = tryParseJsonFromText(aiText.replace(/<[^>]+>/g, "")) ?? null;
    }

    if (!aiJson) {
      aiJson = fallbackParseToJson(String(aiText), stats);
    }

    // sanitize fields
    aiJson.summary = sanitizeStringCandidate(aiJson.summary) ?? null;
    aiJson.shortSummary = sanitizeStringCandidate(aiJson.shortSummary) ?? null;

    // make sure highlights/recommendations are arrays and remove placeholder tokens
    aiJson.highlights = Array.isArray(aiJson.highlights) ? aiJson.highlights.map((s: any) => String(s).replace(/<[^>]+>/g, "").trim()).filter((s: any) => s && s.toLowerCase() !== "summary") : [];
    aiJson.recommendations = Array.isArray(aiJson.recommendations) ? aiJson.recommendations.map((s: any) => String(s).replace(/<[^>]+>/g, "").trim()).filter(Boolean) : [];

    // ensure moodSummary
    aiJson.moodSummary = aiJson.moodSummary ?? statsToMoodSummary(stats);
    // remove 'unknown' from distribution
    const filteredDist: any = {};
    for (const [k, v] of Object.entries(aiJson.moodSummary.distribution ?? aiJson.moodSummary.moodCounts ?? {})) {
      if (String(k).toLowerCase() === "unknown") continue;
      const n = Number(v as any);
      if (Number.isFinite(n) && n > 0) filteredDist[k] = n;
    }
    aiJson.moodSummary = { avgScore: aiJson.moodSummary.avgScore ?? stats?.avgScore ?? null, mostMood: aiJson.moodSummary.mostMood ?? stats?.mostMood ?? null, distribution: filteredDist };

    // fallback shortSummary if still missing
    if (!aiJson.shortSummary) {
      if (aiJson.summary) {
        const one = aiJson.summary.replace(/\s+/g, " ").trim();
        aiJson.shortSummary = one.split(".").map((p: string) => p.trim()).filter(Boolean)[0] ?? null;
      } else if (aiJson.moodSummary?.mostMood) {
        aiJson.shortSummary = `I felt ${aiJson.moodSummary.mostMood} this week.`;
      } else {
        aiJson.shortSummary = null;
      }
    }

    // persist using upsert
    let savedInsight = null;
    try {
      savedInsight = await prisma.weeklyInsight.upsert({
        where: { userId_weekStart: { userId: user.id, weekStart: startISO } as any },
        update: {
          content: JSON.stringify(aiJson),
          weekEnd: endISO,
          shortSummary: aiJson.shortSummary ?? undefined,
          generatedAt: new Date(),
        },
        create: {
          userId: user.id,
          weekStart: startISO,
          weekEnd: endISO,
          content: JSON.stringify(aiJson),
          shortSummary: aiJson.shortSummary ?? undefined,
        },
      });
    } catch (e) {
      try {
        const existing = await prisma.weeklyInsight.findFirst({ where: { userId: user.id, weekStart: startISO } });
        if (existing) {
          savedInsight = await prisma.weeklyInsight.update({
            where: { id: existing.id },
            data: { content: JSON.stringify(aiJson), weekEnd: endISO, shortSummary: aiJson.shortSummary ?? undefined, generatedAt: new Date() },
          });
        } else {
          savedInsight = await prisma.weeklyInsight.create({
            data: { userId: user.id, weekStart: startISO, weekEnd: endISO, content: JSON.stringify(aiJson), shortSummary: aiJson.shortSummary ?? undefined },
          });
        }
      } catch (e2) {
        console.warn("Could not persist weeklyInsight:", (e2 as Error).message);
      }
    }

    return NextResponse.json({ ok: true, insight: aiJson, stats, savedInsight });
  } catch (err: any) {
    console.error("generate insight error:", err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}