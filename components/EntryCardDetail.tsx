"use client";

import { useEffect, useRef, useState, useLayoutEffect } from "react";
import { motion, PanInfo } from "framer-motion";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";
import { moodColorForScore, moodBadgeColor } from "@/lib/moodColor";
import ClientDate from "@/components/ClientDate";

// Category list (12)
const CATEGORIES = [
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
];

type EntryShape = {
  id: string;
  contentRaw?: string | null;
  titleRaw?: string | null;
  contentTidied?: string | null;
  titleTidied?: string | null;
  moodLabel?: string | null;
  moodScore?: number | null;
  category?: string | null;
  dayDate?: string | null; // ISO date string
  tidiedAt?: string | null;
  createdAt: string;
  moodManual?: boolean | null;
  categoryManual?: boolean | null;
  dateManual?: boolean | null;
};

export default function EntryCardDetail({ entry }: { entry: EntryShape }) {
  const router = useRouter();

  // Render/debug counter
  const renderCount = useRef(0);
  renderCount.current += 1;
  useEffect(() => {
    console.log(`[EntryCardDetail] render #${renderCount.current} id=${entry.id}`);
  });

  // Mode: "tidied" or "raw"
  const [mode, setMode] = useState(entry.contentTidied ? "tidied" : "raw");

  // local editable states
  const [rawState, setRawState] = useState({
    title: entry.titleRaw ?? "",
    content: entry.contentRaw ?? "",
    moodLabel: entry.moodManual ? entry.moodLabel ?? "" : entry.moodLabel ?? "",
    moodScore:
      entry.moodManual && entry.moodScore != null
        ? String(entry.moodScore)
        : entry.moodScore != null
          ? String(entry.moodScore)
          : "",
    category: entry.category ?? "",
    date: entry.dayDate ? entry.dayDate.slice(0, 10) : "",
  });

  const [tidiedState, setTidiedState] = useState({
    title: entry.titleTidied ?? "",
    content: entry.contentTidied ?? "",
    moodLabel: entry.moodLabel ?? "",
    moodScore: entry.moodScore != null ? String(entry.moodScore) : "",
    category: entry.category ?? "",
    date: entry.dayDate ? entry.dayDate.slice(0, 10) : "",
  });

  // editing lock and pending external update buffer
  const isEditingRef = useRef(false);
  const pendingEntryRef = useRef<EntryShape | null>(null);
  const lastEntryIdRef = useRef<string | null>(entry.id);

  // Ensure we only re-initialize local state when a different entry is loaded (by id)
  // If we're currently editing, buffer external updates and apply only after save/blur.
  useEffect(() => {
    const applyEntry = (src: EntryShape) => {
      setRawState({
        title: src.titleRaw ?? "",
        content: src.contentRaw ?? "",
        moodLabel: src.moodManual ? src.moodLabel ?? "" : src.moodLabel ?? "",
        moodScore:
          src.moodManual && src.moodScore != null
            ? String(src.moodScore)
            : src.moodScore != null
              ? String(src.moodScore)
              : "",
        category: src.category ?? "",
        date: src.dayDate ? src.dayDate.slice(0, 10) : "",
      });

      setTidiedState({
        title: src.titleTidied ?? "",
        content: src.contentTidied ?? "",
        moodLabel: src.moodLabel ?? "",
        moodScore: src.moodScore != null ? String(src.moodScore) : "",
        category: src.category ?? "",
        date: src.dayDate ? src.dayDate.slice(0, 10) : "",
      });

      // reset mode to match entry when id changes
      setMode(src.contentTidied ? "tidied" : "raw");
      setActiveIndex(src.contentTidied ? 0 : 1);
    };

    // if entry id changed (navigated to different entry) always apply
    if (entry.id !== lastEntryIdRef.current) {
      lastEntryIdRef.current = entry.id;
      pendingEntryRef.current = null;
      applyEntry(entry);
      return;
    }

    // same id — if user is editing, buffer it; otherwise apply immediately
    if (isEditingRef.current) {
      pendingEntryRef.current = entry;
      console.log("[EntryCardDetail] buffering external entry update while editing");
      return;
    }

    // not editing — safe to apply
    applyEntry(entry);
  }, [entry]);

  // saving state
  const savingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  // track whether any field changed (dirty flag)
  const dirtyRef = useRef(false);

  // refs for uncontrolled inputs (title & content) to avoid caret theft during frequent re-renders
  const titleRef = useRef<HTMLInputElement | null>(null);
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  // visual / swipe state
  const [activeIndex, setActiveIndex] = useState(entry.contentTidied ? 0 : 1); // 0 = tidied front, 1 = raw
  useEffect(() => {
    setActiveIndex(entry.contentTidied ? 0 : 1);
  }, [entry.contentTidied]);

  // helpers to map current editing object depending on mode
  const current = mode === "raw" ? rawState : tidiedState;
  const setCurrent = (patch: Partial<typeof rawState>) => {
    if (mode === "raw") setRawState((s) => ({ ...s, ...patch }));
    else setTidiedState((s) => ({ ...s, ...patch }));
    dirtyRef.current = true;
  };

  // compute whether we have tidied data
  const hasTidied = Boolean(entry.contentTidied);

  // Tidy up action - always uses raw text
  async function handleTidy() {
    try {
      toast.loading("Tidying…");
      const res = await fetch(`/api/entries/${entry.id}/tidy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw: (contentRef.current?.value ?? rawState.content ?? "") }),
      });
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: "Invalid response" };
      }
      if (!res.ok) {
        console.error("tidy error", data);
        toast.dismiss();
        toast.error(data?.error || "Tidy failed");
        return;
      }

      const tidy = data.tidy ?? data;
      // update local tidied state
      setTidiedState({
        title: tidy.title ?? tidy.titleTidied ?? "",
        content: tidy.content ?? tidy.contentTidied ?? "",
        moodLabel: tidy.moodLabel ?? tidy.mood_label ?? "",
        moodScore: tidy.moodScore ?? tidy.mood_score ?? "",
        category: tidy.category ?? "",
        date: tidy.date ?? (entry.dayDate ? entry.dayDate.slice(0, 10) : ""),
      });

      setMode("tidied");
      setActiveIndex(0);
      toast.dismiss();
      toast.success("Tidied!");
      // refresh lists/pages if necessary — keep manual to avoid stealing focus
      router.refresh();
    } catch (err) {
      console.error("tidy exception", err);
      toast.error("Tidy failed");
    }
  }

  // Re-tidy: same flow, uses RAW text as source
  async function handleRetidy() {
    await handleTidy();
  }

  // Delete flow
  const [deleting, setDeleting] = useState(false);
  async function handleDelete() {
    if (!confirm("Delete this entry? This action is permanent.")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/entries/${entry.id}/delete`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast.error(body?.error || "Delete failed");
        setDeleting(false);
        return;
      }
      toast.success("Deleted");
      // go back to dashboard
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("delete error", err);
      toast.error("Delete failed");
      setDeleting(false);
    }
  }

  // framer-motion swipe handlers
  const containerRef = useRef<HTMLDivElement | null>(null);
  function handleDragEnd(event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const offset = info.offset.x;
    const velocity = info.velocity.x;

    // threshold
    const SWIPE_THRESHOLD = 120;
    if (offset < -SWIPE_THRESHOLD || velocity < -500) {
      // swipe left → show raw (index 1)
      setActiveIndex(1);
      setMode("raw");
    } else if (offset > SWIPE_THRESHOLD || velocity > 500) {
      // swipe right → show tidied (index 0)
      setActiveIndex(0);
      setMode("tidied");
    } else {
      // small movement — snap back (do nothing)
    }
  }

  // styles/classnames
  const cardClass =
    "card p-5 rounded-xl shadow-md dark:shadow-none bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700";
  const backCardClass =
    "card p-5 rounded-xl shadow-md dark:shadow-none bg-white/70 dark:bg-slate-900/60 border border-slate-300/50 dark:border-slate-700/40 backdrop-blur-[1px]";

  // motion transition
  const transition = { type: "spring" as const, stiffness: 280, damping: 30 };

  // refs to measure & sync heights
  const frontRef = useRef<HTMLDivElement | null>(null);
  const backRef = useRef<HTMLDivElement | null>(null);
  const frontInnerRef = useRef<HTMLDivElement | null>(null);
  const backInnerRef = useRef<HTMLDivElement | null>(null);
  const [maxCardHeight, setMaxCardHeight] = useState<number | null>(null);

  // measure both card natural heights and set both wrapper heights to the max
  useLayoutEffect(() => {
    const getH = (el: HTMLElement | null) => (el ? el.offsetHeight : 0);

    const update = () => {
      const fh = getH(frontInnerRef.current);
      const bh = getH(backInnerRef.current);
      const h = Math.ceil(Math.max(fh, bh));
      setMaxCardHeight(h || null);
    };

    update();

    const ro = new ResizeObserver(update);
    if (frontInnerRef.current) ro.observe(frontInnerRef.current);
    if (backInnerRef.current) ro.observe(backInnerRef.current);

    window.addEventListener("resize", update);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
    // re-run when content changes (tweak dependencies if you want finer control)
  }, [activeIndex, tidiedState.title, tidiedState.content, rawState.content, tidiedState.moodScore, rawState.moodScore]);

  // slider color helper
  const sliderColor = (scoreStr?: string) => {
    const s = scoreStr ? Number(scoreStr) : undefined;
    return moodColorForScore(s ?? 5);
  };

  // helper to convert date-only string to full ISO datetime (or null)
  function localDateToISO(dateStr?: string | null) {
    if (!dateStr) return null;
    // new Date("YYYY-MM-DD") parses as UTC midnight in modern browsers
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  // autosave — called only on explicit Save or pagehide. DOES NOT refresh router automatically.
  async function autoSave() {
    if (savingRef.current) {
      if (abortRef.current) {
        try {
          abortRef.current.abort();
        } catch (e) { }
      }
    }
    savingRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;

    // read latest title/content from DOM refs (uncontrolled inputs) or fallback to state
    const currentTitle = (mode === "raw")
      ? (titleRef.current?.value ?? rawState.title)
      : (titleRef.current?.value ?? tidiedState.title);

    const currentContent = (mode === "raw")
      ? (contentRef.current?.value ?? rawState.content)
      : (contentRef.current?.value ?? tidiedState.content);

    const payload: any = {};
    if (mode === "raw") {
      payload.titleRaw = currentTitle || null;
      payload.contentRaw = currentContent || null;
      payload.dayDate = localDateToISO(rawState.date);
      payload.dateManual = !!rawState.date;
      payload.moodManual = !!(rawState.moodLabel || rawState.moodScore);
      payload.moodLabel = rawState.moodLabel || null;
      payload.moodScore = rawState.moodScore ? Number(rawState.moodScore) : null;
      payload.categoryManual = !!rawState.category;
      payload.category = rawState.category || null;
    } else {
      payload.titleTidied = currentTitle || null;
      payload.contentTidied = currentContent || null;
      payload.dayDate = localDateToISO(tidiedState.date);
      payload.dateManual = !!tidiedState.date;
      payload.moodManual = !!(tidiedState.moodLabel || tidiedState.moodScore);
      payload.moodLabel = tidiedState.moodLabel || null;
      payload.moodScore = tidiedState.moodScore ? Number(tidiedState.moodScore) : null;
      payload.categoryManual = !!tidiedState.category;
      payload.category = tidiedState.category || null;
    }

    // Remove undefined keys (keep nulls)
    Object.keys(payload).forEach((k) => {
      if (typeof (payload as any)[k] === "undefined") delete (payload as any)[k];
    });

    try {
      console.log("[autoSave] sending payload preview", { id: entry.id, payload: Object.keys(payload) });
      const res = await fetch(`/api/entries/${entry.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      abortRef.current = null;

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error("save failed", data);
        toast.error(data?.error || "Save failed");
        return false;
      } else {
        // update local state from server response if present
        if (data?.entry) {
          const updated = data.entry as EntryShape;
          if (mode === "raw") {
            setRawState((p) => ({
              ...p,
              title: updated.titleRaw ?? currentTitle,
              content: updated.contentRaw ?? currentContent,
              moodLabel: updated.moodLabel ?? p.moodLabel,
              moodScore: updated.moodScore != null ? String(updated.moodScore) : p.moodScore,
              category: updated.category ?? p.category,
              date: updated.dayDate ? updated.dayDate.slice(0, 10) : p.date,
            }));
            // sync DOM values
            if (titleRef.current) titleRef.current.value = updated.titleRaw ?? currentTitle ?? "";
            if (contentRef.current) contentRef.current.value = updated.contentRaw ?? currentContent ?? "";
          } else {
            setTidiedState((p) => ({
              ...p,
              title: updated.titleTidied ?? currentTitle,
              content: updated.contentTidied ?? currentContent,
              moodLabel: updated.moodLabel ?? p.moodLabel,
              moodScore: updated.moodScore != null ? String(updated.moodScore) : p.moodScore,
              category: updated.category ?? p.category,
              date: updated.dayDate ? updated.dayDate.slice(0, 10) : p.date,
            }));
            if (titleRef.current) titleRef.current.value = updated.titleTidied ?? currentTitle ?? "";
            if (contentRef.current) contentRef.current.value = updated.contentTidied ?? currentContent ?? "";
          }
          // clear dirty flag after successful save
          dirtyRef.current = false;
        }

        // If there was a buffered external update while we were editing, apply it now
        if (pendingEntryRef.current) {
          console.log('[EntryCardDetail] applying pending external update after save');
          const buffered = pendingEntryRef.current;
          pendingEntryRef.current = null;
          // apply without clobbering current editing session (we already saved)
          setRawState({
            title: buffered.titleRaw ?? "",
            content: buffered.contentRaw ?? "",
            moodLabel: buffered.moodManual ? buffered.moodLabel ?? "" : buffered.moodLabel ?? "",
            moodScore:
              buffered.moodManual && buffered.moodScore != null
                ? String(buffered.moodScore)
                : buffered.moodScore != null
                  ? String(buffered.moodScore)
                  : "",
            category: buffered.category ?? "",
            date: buffered.dayDate ? buffered.dayDate.slice(0, 10) : "",
          });
          setTidiedState({
            title: buffered.titleTidied ?? "",
            content: buffered.contentTidied ?? "",
            moodLabel: buffered.moodLabel ?? "",
            moodScore: buffered.moodScore != null ? String(buffered.moodScore) : "",
            category: buffered.category ?? "",
            date: buffered.dayDate ? buffered.dayDate.slice(0, 10) : "",
          });
        }

        return true;
      }
    } catch (err: any) {
      if (err?.name === "AbortError") {
        // ignore aborted request
      } else {
        console.error("save exception", err);
        toast.error("Save failed");
      }
      return false;
    } finally {
      savingRef.current = false;
    }
  }

  // When user focuses title/content — mark editing so external updates are buffered
  function handleFocusStart() {
    isEditingRef.current = true;
    // console log for visibility
    console.log("[EntryCardDetail] editing started");
  }

  // When user stops editing (blur) — mark editing stopped but do NOT auto-apply buffered updates until Save.
  function handleFocusEnd() {
    isEditingRef.current = false;
    console.log("[EntryCardDetail] editing ended (buffered updates will apply after Save)");
  }

  // Render card content (now accepts disabled flag)
  function CardContent({
    isTidied,
    state,
    setState,
    disabled,
  }: {
    isTidied: boolean;
    state: typeof rawState;
    setState: (s: Partial<typeof rawState>) => void;
    disabled?: boolean;
  }) {
    return (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Title</label>
          {/* Uncontrolled input for smooth typing */}
          <input
            ref={titleRef}
            className="w-full rounded-md border px-3 py-2 dark:bg-slate-900"
            defaultValue={state.title}
            onInput={() => {
              if (disabled) return;
              dirtyRef.current = true;
            }}
            onFocus={handleFocusStart}
            onBlur={handleFocusEnd}
            placeholder="Short title (optional)"
            disabled={disabled}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Content</label>
          {/* Uncontrolled textarea for smooth typing */}
          <textarea
            ref={contentRef}
            rows={8}
            className="w-full rounded-md border px-3 py-2 dark:bg-slate-900 resize-none"
            defaultValue={state.content}
            onInput={() => {
              if (disabled) return;
              dirtyRef.current = true;
            }}
            onFocus={handleFocusStart}
            onBlur={handleFocusEnd}
            disabled={disabled}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-sm text-slate-700 dark:text-slate-300">Mood</label>
            <select
              value={state.moodLabel || ""}
              onChange={(e) => {
                if (disabled) return;
                setState({ moodLabel: e.target.value });
                dirtyRef.current = true;
              }}
              className="w-full rounded-md border px-2 py-2 dark:bg-slate-900"
              disabled={disabled}
            >
              <option value="">(none)</option>
              <option value="joyful">joyful</option>
              <option value="happy">happy</option>
              <option value="calm">calm</option>
              <option value="neutral">neutral</option>
              <option value="tired">tired</option>
              <option value="sad">sad</option>
              <option value="anxious">anxious</option>
              <option value="stressed">stressed</option>
              <option value="frustrated">frustrated</option>
              <option value="angry">angry</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-slate-700 dark:text-slate-300">Mood score</label>
            <input
              type="range"
              min={1}
              max={10}
              step={0.1}
              value={state.moodScore || ""}
              onChange={(e) => {
                if (disabled) return;
                setState({ moodScore: e.target.value });
                dirtyRef.current = true;
              }}
              className="w-full"
              style={{
                accentColor: sliderColor(state.moodScore || ""),
              }}
              disabled={disabled}
            />
            <div className="text-xs mt-1 text-slate-600 dark:text-slate-400">{state.moodScore || "—"}</div>
          </div>

          <div>
            <label className="text-sm text-slate-700 dark:text-slate-300">Category</label>
            <select
              value={state.category || ""}
              onChange={(e) => {
                if (disabled) return;
                setState({ category: e.target.value });
                dirtyRef.current = true;
              }}
              className="w-full rounded-md border px-2 py-2 dark:bg-slate-900"
              disabled={disabled}
            >
              <option value="">(none)</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm text-slate-700 dark:text-slate-300">Date</label>
          <input
            type="date"
            value={state.date || ""}
            onChange={(e) => {
              if (disabled) return;
              setState({ date: e.target.value });
              dirtyRef.current = true;
            }}
            className="w-full rounded-md border px-2 py-2 dark:bg-slate-900"
            disabled={disabled}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <ClientDate iso={entry.createdAt} />
          </div>
          <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">Entry</div>
        </div>

        <div className="flex items-center gap-2">
          {/* toggle buttons */}
          <button
            onClick={() => {
              setMode("raw");
              setActiveIndex(1);
            }}
            className={`px-3 py-1 rounded ${mode === "raw" ? "bg-slate-800 text-white" : "bg-slate-200 dark:bg-slate-700"}`}
          >
            Raw
          </button>
          <button
            onClick={() => {
              setMode("tidied");
              setActiveIndex(0);
            }}
            className={`px-3 py-1 rounded ${mode === "tidied" ? "bg-emerald-600 text-white" : "bg-slate-200 dark:bg-slate-700"}`}
          >
            Tidied
          </button>

          {/* menu */}
          <div className="relative">
            <details className="relative">
              <summary className="cursor-pointer px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">⋯</summary>
              <div className="absolute right-0 mt-2 w-44 bg-white dark:bg-slate-800 border rounded shadow p-2 z-50">
                <button
                  onClick={() => {
                    // open raw editor (same as clicking toggle)
                    setMode("raw");
                    setActiveIndex(1);
                  }}
                  className="w-full text-left px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Edit Raw
                </button>

                <button
                  onClick={() => {
                    setMode("tidied");
                    setActiveIndex(0);
                  }}
                  className="w-full text-left px-2 py-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Edit Tidied
                </button>

                <hr className="my-2" />

                <button
                  onClick={handleDelete}
                  className="w-full text-left px-2 py-1 rounded text-red-600 hover:bg-red-50 dark:hover:bg-red-900"
                >
                  Delete Entry
                </button>
              </div>
            </details>
          </div>
        </div>
      </div>

      {/* swipe container */}
      <div ref={containerRef} className="relative h-auto">
        {/* BACK card - render full form but disabled so it measures identical height */}
        <motion.div
          ref={backRef}
          className="absolute w-full top-0"
          animate={activeIndex === 0 ? { x: -10, scale: 0.985, opacity: 0.88 } : { x: 0, scale: 0.985, opacity: 0.88 }}
          transition={transition}
          style={{
            zIndex: 20,
            pointerEvents: "none", // non-interactive
            height: maxCardHeight ? `${maxCardHeight}px` : undefined, // lock height when measured
          }}
        >
          <div className={cardClass + " bg-opacity-90"}>
            <div ref={backInnerRef} className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  {activeIndex === 0 ? "Raw (behind)" : "Tidied (behind)"}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {/* show the appropriate date for the behind card */}
                  <ClientDate iso={activeIndex === 0 ? entry.createdAt : (entry.tidiedAt ?? entry.createdAt)} />
                </div>
              </div>

              {/* FULL form rendered but disabled so it measures same height as front */}
              {activeIndex === 0 ? (
                <CardContent isTidied={false} state={rawState as any} setState={() => { }} disabled />
              ) : (
                <CardContent isTidied state={tidiedState as any} setState={() => { }} disabled />
              )}

              {/* keep the footer area to match front */}
              <div className="flex items-center justify-between mt-4">
                <div className="text-xs text-slate-500 dark:text-slate-400">Preview</div>
                <div className="flex gap-2">
                  <button disabled className="px-4 py-2 rounded bg-amber-200 text-white opacity-60">Re-Tidy</button>
                  <button disabled className="px-4 py-2 rounded bg-emerald-200 text-white opacity-60">Save</button>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* FRONT card - interactive */}
        <motion.div
          ref={frontRef}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          className="absolute w-full top-0"
          animate={activeIndex === 0 ? { x: 0, scale: 1, opacity: 1 } : { x: 0, scale: 1, opacity: 1 }}
          style={{ zIndex: 30, height: maxCardHeight ? `${maxCardHeight}px` : undefined }}
          transition={transition}
        >
          <div className={cardClass}>
            <div ref={frontInnerRef} className="space-y-4">
              {activeIndex === 0 ? (
                // TIDIED front (full form)
                <>
                  <div className="flex items-start justify-between">
                    <div className="text-sm text-slate-500 dark:text-slate-400">Tidied</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <ClientDate iso={entry.tidiedAt ?? entry.createdAt} />
                    </div>
                  </div>

                  <CardContent isTidied state={tidiedState as any} setState={(s) => setTidiedState((p) => ({ ...p, ...s }))} />

                  <div className="flex items-center justify-between mt-4">
                    <div className="flex gap-3 items-center">
                      <div className="text-xs text-slate-500 dark:text-slate-400">Mood preview</div>
                      <div className="inline-block px-2 py-1 rounded text-xs font-medium" style={{ background: moodBadgeColor(tidiedState.moodLabel || ""), color: "white" }}>
                        {tidiedState.moodLabel || "—"}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={handleRetidy} className="px-4 py-2 rounded bg-amber-500 text-white">Re-Tidy</button>
                      <button
                        onClick={async () => {
                          // Save and then, if successful, apply any buffered external update and optionally rerender parents via router.refresh()
                          const ok = await autoSave();
                          if (ok) {
                            toast.success("Saved");
                            // trigger parent refresh only after explicit save
                            router.refresh();
                          }
                        }}
                        className="px-4 py-2 rounded bg-emerald-600 text-white"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                // RAW front
                <>
                  <div className="flex items-start justify-between">
                    <div className="text-sm text-slate-500 dark:text-slate-400">Raw</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <ClientDate iso={entry.createdAt} />
                    </div>
                  </div>

                  <CardContent isTidied={false} state={rawState as any} setState={(s) => setRawState((p) => ({ ...p, ...s }))} />

                  <div className="flex items-center justify-between mt-4">
                    <div className="text-xs text-slate-500 dark:text-slate-400">Draft</div>

                    <div className="flex gap-2">
                      <button onClick={handleTidy} className="px-4 py-2 rounded bg-amber-500 text-white">Tidy Up</button>
                      <button
                        onClick={async () => {
                          const ok = await autoSave();
                          if (ok) {
                            toast.success("Saved");
                            router.refresh();
                          }
                        }}
                        className="px-4 py-2 rounded bg-emerald-600 text-white"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}