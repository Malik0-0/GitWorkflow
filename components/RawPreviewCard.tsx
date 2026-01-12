// components/RawPreviewCard.tsx
"use client";

import React from "react";
import Link from "next/link";
import { moodBadgeColor } from "@/lib/moodColor";
import { format } from "date-fns";

type PreviewEntry = {
  id: string;
  titleTidied?: string | null;
  titleRaw?: string | null;
  contentTidied?: string | null;
  contentRaw?: string | null;
  moodLabel?: string | null;
  moodScore?: number | null;
  category?: string | null;
  dayDate?: string | Date | null;
  tidiedAt?: string | Date | null;
  createdAt?: string | Date | null;
  tidied?: boolean;
};

// --- helpers ------------------------------------------------------
function normalize(iso?: string | Date | null): string {
  if (!iso) return "";
  return iso instanceof Date ? iso.toISOString() : String(iso);
}

/**
 * Deterministic date formatting (NO locale).
 * Always formats to dd/MM/yyyy (or change as you prefer).
 */
export function formatDateForDisplay(value?: string | Date | null): string {
  if (!value) return "";

  try {
    // If YYYY-MM-DD (date-only), parse manually in UTC
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      const dt = new Date(Date.UTC(y, m - 1, d));
      return format(dt, "dd/MM/yyyy");
    }

    // Otherwise parse normally
    const dt = value instanceof Date ? value : new Date(normalize(value));
    return format(dt, "dd/MM/yyyy");
  } catch {
    return String(value);
  }
}

/** Does this value contain a time component? */
function hasTimePart(value?: string | Date | null) {
  if (!value) return false;
  if (value instanceof Date) return true;
  const s = String(value);
  return s.includes("T") || /\d{2}:\d{2}/.test(s);
}

/** Deterministic time formatter HH:mm */
function extractTime(value?: string | Date | null) {
  if (!hasTimePart(value)) return "";
  try {
    const dt = value instanceof Date ? value : new Date(normalize(value));
    return format(dt, "HH:mm");
  } catch {
    return "";
  }
}
// -----------------------------------------------------------------

export default function RawPreviewCard({ entry, huge = true }: { entry: PreviewEntry; huge?: boolean }) {
  const title = entry.titleTidied ?? entry.titleRaw ?? "";
  const content = entry.contentTidied ?? entry.contentRaw ?? "";

  // Safe format (SSR + Client identical)
  const dateLabel = formatDateForDisplay(entry.dayDate ?? entry.tidiedAt ?? entry.createdAt ?? null);
  const timeLabel = extractTime(entry.tidiedAt) || extractTime(entry.createdAt) || "";

  const cardClass = huge
    ? "card p-5 rounded-xl shadow-md bg-white dark:bg-slate-900 border dark:border-slate-700"
    : "card p-3 rounded-md border";

  const snippet = content
    ? content.length > 90
      ? content.slice(0, 90) + "…"
      : content
    : "No content";

  return (
    <Link href={`/entries/${entry.id}`} className="block no-underline">
      <article className={cardClass}>
        {/* date + time */}
        <div className="flex items-start justify-between mb-3">
          <div className="text-sm text-slate-500">{dateLabel}</div>
          <div className="text-xs text-slate-500">{timeLabel}</div>
        </div>

        <div className="mt-2 font-medium text-lg">{title || "Untitled"}</div>

        <div
          className="mt-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed break-words"
          style={{ whiteSpace: "pre-wrap" }}
        >
          {snippet}
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <div
              className="inline-block px-2 py-1 rounded text-xs font-medium text-black"
              style={{ background: moodBadgeColor(entry.moodLabel ?? "") }}
            >
              {entry.moodLabel ?? "-"}
            </div>
            {typeof entry.moodScore === "number" ? (
              <div className="text-xs text-slate-400">score {entry.moodScore}</div>
            ) : null}
          </div>
          <div>{entry.category ?? "-"}</div>
        </div>
      </article>
    </Link>
  );
}