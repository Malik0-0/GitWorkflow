// components/EntryCard.tsx
"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { moodBadgeColor } from "@/lib/moodColor";

type Entry = {
  id: string;
  contentRaw: string | null;
  contentTidied?: string | null;
  titleRaw?: string | null;
  titleTidied?: string | null;
  moodLabel?: string | null;
  moodScore?: number | null;
  category?: string | null;
  createdAt: string;
};

export default function EntryCard({ entry: initialEntry, onUpdated }: { entry: Entry; onUpdated?: (e: Entry) => void }) {
  const [showRaw, setShowRaw] = useState(false);
  const [loadingTidy, setLoadingTidy] = useState(false);
  const [entry, setEntry] = useState<Entry>(initialEntry);

  async function handleTidy(useSource: "raw" | "tidied") {
    setLoadingTidy(true);
    try {
      const payload = {
        raw: useSource === "raw" ? entry.contentRaw ?? "" : entry.contentTidied ?? entry.contentRaw ?? "",
      };
      const res = await fetch(`/api/entries/${entry.id}/tidy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = { rawText: text };
      }

      if (!res.ok) {
        console.error("tidy failed", data);
        toast.error(data?.error || "Tidy failed");
        return;
      }

      // Backend may return { entry } or { tidy } or { tidy: updatedEntry } — handle common shapes
      const updatedEntryCandidate = data?.entry ?? data?.tidy ?? data?.tidy?.entry ?? data;
      // If shape contains 'id' and content fields, accept it
      if (updatedEntryCandidate && updatedEntryCandidate.id) {
        const updated: Entry = {
          id: updatedEntryCandidate.id,
          contentRaw: updatedEntryCandidate.contentRaw ?? updatedEntryCandidate.content ?? entry.contentRaw,
          contentTidied: updatedEntryCandidate.contentTidied ?? updatedEntryCandidate.contentTidied ?? entry.contentTidied,
          titleRaw: updatedEntryCandidate.titleRaw ?? updatedEntryCandidate.title ?? entry.titleRaw,
          titleTidied: updatedEntryCandidate.titleTidied ?? updatedEntryCandidate.titleTidied ?? entry.titleTidied,
          moodLabel: updatedEntryCandidate.moodLabel ?? updatedEntryCandidate.mood ?? entry.moodLabel,
          moodScore: updatedEntryCandidate.moodScore ?? updatedEntryCandidate.mood_score ?? entry.moodScore,
          category: updatedEntryCandidate.category ?? entry.category,
          createdAt: updatedEntryCandidate.createdAt ?? entry.createdAt,
        };
        setEntry(updated);
        if (onUpdated) onUpdated(updated);
        toast.success("Tidied");
      } else {
        // If backend returned the tidy object (not DB entry), map fields conservatively
        const tidy = data?.tidy ?? data;
        const patched: Entry = {
          ...entry,
          contentTidied: tidy?.content ?? tidy?.contentTidied ?? entry.contentTidied,
          titleTidied: tidy?.title ?? tidy?.titleTidied ?? entry.titleTidied,
          moodLabel: tidy?.moodLabel ?? tidy?.mood ?? entry.moodLabel,
          moodScore: tidy?.moodScore ?? tidy?.mood_score ?? entry.moodScore,
        };
        setEntry(patched);
        if (onUpdated) onUpdated(patched);
        toast.success("Tidied");
      }
    } catch (err: any) {
      console.error("tidy error", err);
      toast.error(err?.message || "Network error");
    } finally {
      setLoadingTidy(false);
    }
  }

  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">
            {entry.titleTidied ?? entry.titleRaw ?? "Untitled"}
          </h3>

          <div className="text-sm text-slate-600 dark:text-slate-400 mt-2">
            {showRaw ? (entry.contentRaw ?? "No content") : (entry.contentTidied ?? entry.contentRaw ?? "No content")}
          </div>

          <div className="text-xs text-slate-500 dark:text-slate-400 mt-3">{new Date(entry.createdAt).toLocaleString()}</div>
        </div>

        <div className="flex flex-col gap-2 items-end">
          {/* Mood badge */}
          <div className="flex items-center gap-2">
            <div
              className="inline-flex items-center gap-2 px-2 py-1 rounded text-xs font-medium"
              style={{ background: moodBadgeColor(entry.moodLabel ?? ""), color: "white" }}
            >
              <span>{entry.moodLabel ?? "-"}</span>
              {entry.moodScore != null && <span className="ml-1 text-[11px] opacity-90">· {Number(entry.moodScore).toFixed(1)}</span>}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <button
              onClick={() => setShowRaw((s) => !s)}
              className="px-2 py-1 rounded border text-sm border-slate-200 dark:border-slate-700"
            >
              {showRaw ? "Show Tidied" : "Show Raw"}
            </button>

            <button
              onClick={() => handleTidy("raw")}
              className="px-2 py-1 rounded bg-amber-500 text-white text-sm"
              disabled={loadingTidy}
            >
              {loadingTidy ? "Tidying..." : "Tidy Raw"}
            </button>

            <button
              onClick={() => handleTidy("tidied")}
              className="px-2 py-1 rounded border border-slate-200 text-sm"
              disabled={loadingTidy}
            >
              {loadingTidy ? "Tidying..." : "Tidy Tidied"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}