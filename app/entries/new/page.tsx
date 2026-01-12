// app/entries/new/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import VoiceRecorder from "@/components/VoiceRecorder";

const MAX_LEN = 1000;
const AUTO_TIDY_KEY = "cleannote_auto_tidy";

export default function NewEntryPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [mood, setMood] = useState("");
  const [moodScore, setMoodScore] = useState<number | "">("");
  const [category, setCategory] = useState("");
  const [dayDate, setDayDate] = useState("");

  // auto tidy checkbox (remembered)
  const [autoTidy, setAutoTidy] = useState(true);

  // preview modal state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

  const taRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // read persisted auto tidy preference (default: true)
    try {
      const v = localStorage.getItem(AUTO_TIDY_KEY);
      if (v == null) setAutoTidy(true);
      else setAutoTidy(v === "1");
    } catch {
      setAutoTidy(true);
    }
  }, []);

  useEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = "0px";
    const newHeight = Math.min(ta.scrollHeight, 800);
    ta.style.height = `${newHeight}px`;
  }, [text]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      toast.error("Write something first");
      return;
    }
    if (text.length > MAX_LEN) {
      toast.error(`Max ${MAX_LEN} characters`);
      return;
    }

    setLoading(true);
    try {
      // If autoTidy is enabled, try to get preview from server first
      if (autoTidy) {
        let preview: any = null;
        try {
          const res = await fetch("/api/entries/preview-tidy", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              raw: text,
              title: title || null,
              moodLabel: mood || null,
              category: category || null,
            }),
          });

          const txt = await res.text();
          try {
            preview = JSON.parse(txt);
          } catch {
            console.warn("Non-JSON preview:", txt);
            preview = null;
          }

          if (!res.ok || !preview) {
            console.warn("Preview tidy failed or invalid, falling back to raw save", preview);
            toast.error("Tidy preview failed, saving raw entry");
            // proceed to save raw below
            preview = null;
          } else {
            // server returns an object; expected shape { preview: { ... } } or similar
            if (preview.preview) preview = preview.preview;
          }
        } catch (err) {
          console.error("Preview tidy exception, saving raw instead", err);
          toast.error("Tidy preview failed, saving raw entry");
          preview = null;
        }

        // if we have preview data, use tidied save flow
        if (preview) {
          const payload: any = {
            content: text,
            titleTidied: preview.title || undefined,
            contentTidied: preview.contentTidied || undefined,
            mood: preview.moodLabel || mood || undefined,
            moodLabel: preview.moodLabel || mood || undefined,
            moodScore:
              preview.moodScore != null
                ? Number(preview.moodScore)
                : moodScore === ""
                ? undefined
                : Number(moodScore),
            category: preview.category || category || undefined,
            dayDate: preview.date || dayDate || undefined,
            isTidied: true,
          };

          const res = await fetch("/api/entries", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

          const data = await res.json();
          if (!res.ok) {
            console.error("Save tidied entry error:", data);
            toast.error(data?.error || "Failed to save entry");
            setLoading(false);
            return;
          }

          toast.success("Saved tidied entry");
          try {
            localStorage.setItem("cleannote_session_updated", Date.now().toString());
          } catch {}
          router.replace("/dashboard");
          router.refresh();
          setLoading(false);
          return;
        }
        // else fallthrough to save raw
      }

      // Save raw entry (either autoTidy disabled or preview failed)
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          title: title.trim() === "" ? undefined : title,
          // send both keys to be backwards-compatible
          mood: mood.trim() === "" ? undefined : mood,
          moodLabel: mood.trim() === "" ? undefined : mood,
          moodScore: moodScore === "" ? undefined : Number(moodScore),
          category: category.trim() === "" ? undefined : category,
          dayDate: dayDate || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Create entry error:", data);
        toast.error(data?.error || "Failed to save entry");
        setLoading(false);
        return;
      }

      toast.success("Saved raw entry");
      try {
        localStorage.setItem("cleannote_session_updated", Date.now().toString());
      } catch {}
      router.replace("/dashboard");
      router.refresh();
    } catch (err: any) {
      console.error("Create entry exception:", err);
      toast.error(err?.message || "Network error");
    } finally {
      setLoading(false);
    }
  }

  // Tidy preview action (calls server preview endpoint) - retained for manual preview
  async function handleTidyPreview() {
    if (!text.trim()) {
      toast.error("Write something first");
      return;
    }

    setPreviewLoading(true);
    try {
      const res = await fetch("/api/entries/preview-tidy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw: text,
          title: title || null,
          moodLabel: mood || null,
          category: category || null,
        }),
      });

      const txt = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(txt);
      } catch {
        console.warn("Non-JSON preview:", txt);
        toast.error("Invalid AI response");
        setPreviewLoading(false);
        return;
      }

      if (!res.ok) {
        console.error("preview tidy failed", data);
        toast.error(data?.error || "Preview failed");
        setPreviewLoading(false);
        return;
      }

      setPreviewData(data.preview);
      setPreviewOpen(true);
    } catch (err) {
      console.error("preview tidy exception", err);
      toast.error("Preview failed");
    } finally {
      setPreviewLoading(false);
    }
  }

  // When user accepts preview and clicks Save in modal, call create endpoint with preview fields
  async function saveFromPreview() {
    if (!previewData) return;

    setLoading(true);
    try {
      const payload: any = {
        content: text,
        titleTidied: previewData.title || undefined,
        contentTidied: previewData.contentTidied || undefined,
        mood: previewData.moodLabel || mood || undefined,
        moodLabel: previewData.moodLabel || mood || undefined,
        moodScore:
          previewData.moodScore != null
            ? Number(previewData.moodScore)
            : moodScore === ""
            ? undefined
            : Number(moodScore),
        category: previewData.category || category || undefined,
        dayDate: previewData.date || dayDate || undefined,
        isTidied: true,
      };

      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("Save tidied entry error:", data);
        toast.error(data?.error || "Failed to save entry");
        setLoading(false);
        return;
      }

      toast.success("Saved tidied entry");
      try {
        localStorage.setItem("cleannote_session_updated", Date.now().toString());
      } catch {}

      router.replace("/dashboard");
      router.refresh();
    } catch (err) {
      console.error("Save from preview exception:", err);
      toast.error("Save failed");
    } finally {
      setLoading(false);
    }
  }

  function handleTranscript(transcript: string) {
    if (!transcript) return;
    setText((prev) => (prev ? `${prev}\n${transcript}` : transcript));
    try {
      taRef.current?.focus();
    } catch {}
  }

  function toggleAutoTidy(next: boolean) {
    setAutoTidy(next);
    try {
      localStorage.setItem(AUTO_TIDY_KEY, next ? "1" : "0");
    } catch {}
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="card p-6">

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-800 dark:text-slate-400 mb-2">
                Your note
              </label>

              {/* textarea + mic on the same line */}
              <div className="flex items-end gap-2">
                <textarea
                  ref={taRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Write your thought... (up to 1000 characters)"
                  rows={6}
                  maxLength={MAX_LEN}
                  className="flex-1 rounded-md border border-slate-700 dark:bg-slate-900 bg-slate-100 px-4 py-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 resize-none"
                />

                {/* mic button, vertically aligned with textarea like WhatsApp */}
                <div className="pb-1">
                  <VoiceRecorder
                    onTranscript={(t) => handleTranscript(t)}
                    maxSeconds={60}
                    append={true}
                  />
                </div>
              </div>

              {/* counter + tip below the bar */}
              <div className="mt-2 rounded-md px-3 py-1.5 text-xs text-slate-500 flex items-center justify-between">
                <span>{text.length}/{MAX_LEN}</span>
                <span className="italic">
                  Tip: Auto tidy can refine content when saving.
                </span>
              </div>
            </div>


            <div className="flex items-center gap-4 mt-4">
              <label className="inline-flex items-center gap-2 text-sm text-slate-800 dark:text-slate-400">
                <input
                  type="checkbox"
                  checked={autoTidy}
                  onChange={(e) => toggleAutoTidy(e.target.checked)}
                  className="w-4 h-4"
                />
                <span>Automatically tidy on save</span>
              </label>

              <button type="button" onClick={() => setAdvancedOpen((s) => !s)} className="text-sm text-slate-800 dark:text-slate-400 underline">
                Advanced options
              </button>
            </div>

            {advancedOpen && (
              <div className="mt-4 border border-slate-700 rounded-md p-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-slate-800 dark:text-slate-400 mb-2">Title</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-md border border-slate-700 dark:bg-slate-900 bg-slate-100 px-3 py-2 text-slate-900 dark:text-slate-100 placeholder:text-slate-500" />
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-800 dark:text-slate-400 mb-1">Mood</label>
                    <input value={mood} onChange={(e) => setMood(e.target.value)} placeholder="e.g., calm / tenang" className="w-full rounded-md border border-slate-700 dark:bg-slate-900 bg-slate-100 px-3 py-2 text-slate-800 dark:text-slate-400" />
                  </div>

                  <div>
                    <label className="block text-sm text-slate-800 dark:text-slate-400 mb-1">Category</label>
                    <input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g., work / kerjaan" className="w-full rounded-md border border-slate-700 dark:bg-slate-900 bg-slate-100 px-3 py-2 text-slate-800 dark:text-slate-400" />
                  </div>
                </div>

                <div className="mt-4">
                  <label className="block text-sm text-slate-800 dark:text-slate-400 mb-1">Mood score (1.0 - 10.0)</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={1}
                      max={10}
                      step={0.5}
                      value={moodScore === "" ? 5 : moodScore}
                      onChange={(e) => setMoodScore(Number(e.target.value))}
                      className="w-full"
                    />
                    <input
                      type="number"
                      min={1}
                      max={10}
                      step={0.1}
                      value={moodScore === "" ? "" : moodScore}
                      onChange={(e) => {
                        const v = e.target.value;
                        setMoodScore(v === "" ? "" : Number(v));
                      }}
                      className="w-20 rounded-md border px-2 py-1 dark:bg-slate-800"
                      placeholder="—"
                    />
                  </div>
                </div>

                <div className="text-xs text-slate-500 mt-2">These fields help the AI and improve weekly insights.</div>
              </div>
            )}

            <div className="mt-6 flex items-center justify-end gap-3">
              <button type="button" onClick={handleTidyPreview} className="px-3 py-2 rounded bg-amber-500 text-white text-medium" disabled={previewLoading}>
                {previewLoading ? "Tidying…" : "Preview"}
              </button>

              <button type="submit" className="px-3 py-2 rounded bg-emerald-500 text-white font-medium shadow" disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </button>
              </div>
          </div>
        </form>

        {/* PREVIEW MODAL */}
        {previewOpen && previewData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60" onClick={() => setPreviewOpen(false)} />
            <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded p-6 z-10">
              <h3 className="text-lg font-semibold mb-3">Tidy preview</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-slate-600 mb-1">Title</label>
                  <input value={previewData.title} onChange={(e) => setPreviewData((p:any) => ({...p, title: e.target.value}))} className="w-full rounded-md border px-3 py-2 dark:bg-slate-800" />
                </div>

                <div>
                  <label className="block text-xs text-slate-600 mb-1">Tidied content</label>
                  <textarea rows={6} value={previewData.contentTidied} onChange={(e) => setPreviewData((p:any) => ({...p, contentTidied: e.target.value}))} className="w-full rounded-md border px-3 py-2 dark:bg-slate-800 resize-none" />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Mood</label>
                    <input value={previewData.moodLabel ?? ""} onChange={(e) => setPreviewData((p:any)=>({...p, moodLabel: e.target.value}))} className="w-full rounded-md border px-2 py-2 dark:bg-slate-800" />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Mood score</label>
                    <input value={previewData.moodScore ?? ""} onChange={(e) => setPreviewData((p:any)=>({...p, moodScore: e.target.value}))} className="w-full rounded-md border px-2 py-2 dark:bg-slate-800" />
                  </div>

                  <div>
                    <label className="block text-xs text-slate-600 mb-1">Category</label>
                    <input value={previewData.category ?? ""} onChange={(e) => setPreviewData((p:any)=>({...p, category: e.target.value}))} className="w-full rounded-md border px-2 py-2 dark:bg-slate-800" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-600 mb-1">Date</label>
                  <input type="date" value={previewData.date ?? ""} onChange={(e) => setPreviewData((p:any)=>({...p, date: e.target.value}))} className="rounded-md border px-2 py-2 dark:bg-slate-800" />
                </div>
              </div>

              <div className="mt-4 flex justify-end gap-3">
                <button onClick={() => setPreviewOpen(false)} className="px-4 py-2 rounded border">Close</button>
                <button onClick={saveFromPreview} className="px-4 py-2 rounded bg-emerald-600 text-white">Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}