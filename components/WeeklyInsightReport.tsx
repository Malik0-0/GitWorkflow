// components/WeeklyInsightReport.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import MoodDonut from "./charts/MoodDonut";
import MoodLineChart from "./charts/MoodLineChart";
import { format, parseISO, addDays } from "date-fns";

function moodToEmoji(mood: string | null) {
  if (!mood) return "😶";
  const m = mood.toLowerCase();
  if (m.includes("happy") || m.includes("joy")) return "😄";
  if (m.includes("sad") || m.includes("down")) return "😢";
  if (m.includes("angry") || m.includes("frustrat")) return "😠";
  if (m.includes("calm") || m.includes("content") || m.includes("relax")) return "😊";
  if (m.includes("anxious") || m.includes("nervous")) return "😬";
  if (m.includes("tired") || m.includes("exhaust")) return "😴";
  return "🙂";
}

function extractJsonObject(text: string): any | null {
  if (!text) return null;
  try { return JSON.parse(text); } catch { }
  const m = text.match(/\{[\s\S]*\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch { }
  }
  return null;
}

function cleanTokenString(s?: any): string | null {
  if (!s || typeof s !== "string") return null;
  const cleaned = s.replace(/<[^>]+>/g, "").trim();
  if (!cleaned) return null;
  if (/^think\b/i.test(cleaned) || /^<*think>*$/i.test(cleaned)) return null;
  if (/^ok\b/i.test(cleaned) && cleaned.length < 10) return null;
  return cleaned;
}

function normalizeInsight(raw: any, stats: any) {
  if (!raw) {
    return {
      summary: null,
      shortSummary: null,
      recommendations: [],
      highlights: [],
      moodSummary: stats ?? { avgScore: null, mostMood: null, distribution: {} },
    };
  }
  if (typeof raw === "string") {
    const parsed = extractJsonObject(raw);
    if (parsed) raw = parsed;
  }
  if (raw?.insight && typeof raw.insight === "object") raw = raw.insight;

  const summaryCandidate = cleanTokenString(raw.summary ?? raw.text ?? null);
  const shortCandidate = cleanTokenString(raw.shortSummary ?? null);

  let summary = summaryCandidate ?? null;
  let shortSummary = shortCandidate ?? null;

  if (!summary && raw.content) summary = cleanTokenString(raw.content) ?? null;

  if (!shortSummary && summary) {
    const one = summary.replace(/\s+/g, " ").trim();
    const firstSent = one.split(".").map(p => p.trim()).filter(Boolean)[0] ?? one;
    shortSummary = firstSent && firstSent.length > 0 ? (firstSent + (firstSent.endsWith(".") ? "" : ".")) : null;
  }

  const recommendations = Array.isArray(raw.recommendations) ? raw.recommendations.map((r: any) => String(r).replace(/<[^>]+>/g, "").trim()).filter(Boolean) : (typeof raw.recommendations === "string" ? raw.recommendations.split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean) : []);
  let highlights = Array.isArray(raw.highlights) ? raw.highlights.map((h: any) => String(h).replace(/<[^>]+>/g, "").trim()).filter((h: any) => h && h.toLowerCase() !== "summary") : (typeof raw.highlights === "string" ? raw.highlights.split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean) : []);

  let moodSummary = stats ?? { avgScore: null, mostMood: null, distribution: {} };
  if (raw.moodSummary && typeof raw.moodSummary === "object") {
    moodSummary = {
      avgScore: raw.moodSummary.avgScore ?? null,
      mostMood: raw.moodSummary.mostMood ?? null,
      distribution: {},
    };
    for (const [k, v] of Object.entries(raw.moodSummary.distribution ?? raw.moodSummary.moodCounts ?? {})) {
      if (String(k).toLowerCase() === "unknown") continue;
      const n = Number(v as any);
      if (Number.isFinite(n) && n > 0) moodSummary.distribution[String(k)] = n;
    }
  }

  if (!shortSummary) {
    if (moodSummary?.mostMood) {
      shortSummary = `I felt ${moodSummary.mostMood} this week.`;
    } else if (summary) {
      shortSummary = summary.split(".").map(p => p.trim()).filter(Boolean)[0] ?? null;
    }
  }

  if (summary && /^<?think>?$/i.test(summary.trim())) summary = null;
  if (shortSummary && /^<?think>?$/i.test(shortSummary.trim())) shortSummary = null;

  return { summary, shortSummary, recommendations, highlights, moodSummary };
}

export default function WeeklyInsightReport({ weekStart }: { weekStart: string }) {
  const [loading, setLoading] = useState(true);
  const [rawInsight, setRawInsight] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  // unified loader: try saved insight first, else generate
  async function fetchSavedOrGenerate() {
    setError(null);
    setLoading(true);
    try {
      // 1) try GET saved insight + stats
      const getRes = await fetch(`/api/insights/get?weekStart=${encodeURIComponent(weekStart)}`, { method: "GET" });
      const getJson = await getRes.json();
      console.log("GET /api/insights/get result:", getJson);

      if (getRes.ok && getJson?.savedInsight) {
        // savedInsight.content is stored as string in DB
        let parsedContent: any = null;
        try {
          parsedContent = typeof getJson.savedInsight.content === "string" ? JSON.parse(getJson.savedInsight.content) : getJson.savedInsight.content;
        } catch (e) {
          parsedContent = getJson.savedInsight.content;
        }
        setRawInsight(parsedContent ?? getJson.savedInsight ?? null);
        setStats(getJson.stats ?? {});
        setLoading(false);
        return;
      }

      // 2) no saved insight -> call generate endpoint
      const res = await fetch(`/api/insights/generate?weekStart=${encodeURIComponent(weekStart)}`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to generate insight");
      console.log("POST /api/insights/generate result:", json);
      setRawInsight(json.insight ?? json);
      setStats(json.stats ?? {});
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSavedOrGenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const insight = normalizeInsight(rawInsight, stats);

  async function handleSave(alsoBack = true) {
    setSaving(true);
    setError(null);
    try {
      const payload = { weekStart, weekEnd: (rawInsight?.weekEnd ?? null), content: rawInsight ?? insight, shortSummary: insight.shortSummary ?? null };
      const res = await fetch("/api/insights/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to save");
      if (alsoBack) router.push("/dashboard");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  // explicit regenerate (user-initiated)
  async function handleRegenerate() {
    setRegenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/insights/generate?weekStart=${encodeURIComponent(weekStart)}`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error || "Failed to regenerate");
      setRawInsight(j.insight ?? j);
      setStats(j.stats ?? {});
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setRegenerating(false);
    }
  }

  async function downloadPDF() {
    if (!containerRef.current) return;
    const canvas = await html2canvas(containerRef.current, { scale: 2 });
    const img = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const width = pdf.internal.pageSize.getWidth();
    const imgProps = pdf.getImageProperties(img);
    const height = (imgProps.height * width) / imgProps.width;
    pdf.addImage(img, "PNG", 0, 0, width, height);
    pdf.save(`insight-${weekStart}.pdf`);
  }

  if (loading) return <div className="card p-4">Loading insight…</div>;
  if (error) return <div className="card p-4 text-red-600">Error: {error}</div>;

  // debug: inspect stats shape in console
  console.log("WeeklyInsightReport stats:", stats);

  // build distribution array for donut
  const distributionArray = Object.entries(insight.moodSummary.distribution ?? {}).map(([name, value]) => ({ name, value: Number(value) })).filter(d => d.value > 0);

  // Build last7Days for MoodLineChart:
  // Accepts stats.last7Days OR stats.last_7_days OR compute from stats.days if provided
  function buildLast7FromDayScores(dayScores: Record<string, number | { avg?: number }>, weekStartIso: string) {
    const out: { date: string; avgMoodScore: number | null }[] = [];
    if (!weekStartIso) return out;
    // build 7 days from weekStart inclusive
    try {
      const start = parseISO(weekStartIso);
      for (let i = 0; i < 7; i++) {
        const d = addDays(start, i);
        const key = format(d, "yyyy-MM-dd");
        const val = (dayScores && (dayScores as any)[key]);
        const score = typeof val === "number" ? val : (val && typeof val.avg === "number" ? val.avg : null);
        out.push({ date: key, avgMoodScore: Number.isFinite(score) ? Number(score) : null });
      }
    } catch (e) {
      // fallback: turn whatever is in dayScores into an array (last 7 unordered)
      const entries = Object.entries(dayScores || {}).slice(-7).map(([date, v]) => ({ date, avgMoodScore: typeof v === "number" ? v : (v?.avg ?? null) }));
      return entries;
    }
    return out;
  }

  function computeStreakFromDayScores(dayScores: Record<string, number | { avg?: number }>) {
    if (!dayScores || Object.keys(dayScores).length === 0) return 0;
    // get all dates present, sorted ascending
    const dates = Object.keys(dayScores).map(s => s).sort(); // keys are YYYY-MM-DD, lexicographic sorts by date
    // latest date string
    const latest = dates[dates.length - 1];
    let streak = 0;
    try {
      let cur = parseISO(latest);
      // count consecutive days backwards while dayScores has that date
      while (true) {
        const key = format(cur, "yyyy-MM-dd");
        if (!Object.prototype.hasOwnProperty.call(dayScores, key)) break;
        streak++;
        // step back one day
        cur = addDays(cur, -1);
      }
    } catch (e) {
      return 0;
    }
    return streak;
  }

  // derive last7Days:
  let last7Days: { date: string; avgMoodScore: number | null }[] = [];
  if (Array.isArray(stats?.last7Days) && stats.last7Days.length > 0) {
    last7Days = stats.last7Days.map((d: any) => ({ date: d.date, avgMoodScore: d.avgMoodScore ?? d.avg ?? null }));
  } else if (stats?.dayScores && typeof stats.dayScores === "object") {
    last7Days = buildLast7FromDayScores(stats.dayScores, weekStart);
  } else {
    // fallback existing attempts (keep your previous fallbacks)
    if (stats?.last_7_days && Array.isArray(stats.last_7_days)) {
      last7Days = stats.last_7_days.map((d: any) => ({ date: d.date, avgMoodScore: d.avgMoodScore ?? d.avg ?? null }));
    } else if (stats?.last7 && Array.isArray(stats.last7)) {
      last7Days = stats.last7.map((d: any) => ({ date: d.date, avgMoodScore: d.avgMoodScore ?? d.avg ?? null }));
    } else if (stats?.days && typeof stats.days === "object") {
      last7Days = Object.entries(stats.days).slice(-7).map(([date, val]: any) => ({ date, avgMoodScore: val?.avg ?? null }));
    } else {
      last7Days = [];
    }
  }

  // derive streak:
  const computedStreak = typeof stats?.streak === "number" ? stats.streak : computeStreakFromDayScores(stats?.dayScores ?? {});

  return (
    <div ref={containerRef} className="card p-4 space-y-4 bg-white text-slate-900">
      <div className="flex items-left gap-3 justify-left">
        <div className="flex gap-2">
          <button onClick={handleRegenerate} className={`btn-secondary ${regenerating ? "opacity-80" : ""}`}>{regenerating ? "Regenerating..." : "Regenerate"}</button>
          <button onClick={() => handleSave(true)} className="btn-secondary">{saving ? "Saving…" : "Save & Back"}</button>
          <button onClick={downloadPDF} className="btn-secondary">Download to PDF</button>
        </div>
      </div>
      {/* <div className="flex items-start justify-between gap-4"> */}
        <div className="flex-1">
          <div className="flex items-center border rounded p-3 bg-white shadow-sm mt-5 justify-center">
            <div className="text-2xl mr-3">{moodToEmoji(insight.moodSummary?.mostMood ?? null)}</div>
            <div className="text-sm">
              <div className="text-xs text-slate-500">Streak: {computedStreak}</div>
              <div className="text-xs text-slate-500">Most frequent mood</div>
              <div className="font-semibold">{(insight.moodSummary?.mostMood ?? "—").toString()}</div>
            </div>
          </div>

          <div className="text-sm text-slate-500 mt-3">Summary</div>
          <div className="mt-1 text-lg font-semibold text-justify">{insight.shortSummary ?? (insight.summary ? insight.summary.split(".")[0] + "." : "No short summary")}</div>
        </div>
      {/* </div> */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="border rounded p-3">
          <div className="text-sm text-slate-600">Mood distribution</div>
          <div className="h-48 mt-3" style={{ minWidth: 0, minHeight: 192 }}>
            {distributionArray.length === 0 ? (
              <div className="text-sm text-slate-500">No mood data</div>
            ) : (
              <MoodDonut data={distributionArray} />
            )}
          </div>
        </div>

        <div className="border rounded p-3">
          <div className="text-sm text-slate-600">Mood track</div>
          <div className="h-48 mt-3" style={{ minWidth: 0, minHeight: 192 }}>
            <MoodLineChart data={last7Days} />
          </div>
        </div>
      </div>

      <div className="border rounded p-3">
        <div className="text-sm text-slate-600">Story of the week</div>
        <div className="mt-2 text-sm leading-relaxed whitespace-pre-wrap text-justify">{insight.summary ?? "No summary available."}</div>
      </div>

      <div className="border rounded p-3">
        <div className="text-sm text-slate-600">Highlights</div>
        <ul className="mt-2 list-disc list-inside">
          {(insight.highlights ?? []).length === 0 ? (
            <li className="text-sm text-slate-500">No highlights</li>
          ) : (
            insight.highlights.map((h: string, i: number) => <li key={i} className="text-sm">{h}</li>)
          )}
        </ul>
      </div>

      <div className="border rounded p-3">
        <div className="text-sm text-slate-600">AI recommendations</div>
        <ol className="mt-2 list-decimal list-inside">
          {(insight.recommendations ?? []).length === 0 ? (
            <li className="text-sm text-slate-500">No recommendations</li>
          ) : (
            insight.recommendations.map((r: string, i: number) => <li key={i} className="text-sm">{r}</li>)
          )}
        </ol>
      </div>
    </div>
  );
}