// components/SmallGenerateButton.tsx
"use client";
import React, { useState } from "react";

export default function SmallGenerateButton({ weekStart, onDone }: { weekStart: string; onDone?: (insight:any)=>void; }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string|null>(null);

  async function generate() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/insights/generate?weekStart=${encodeURIComponent(weekStart)}`, { method: "POST" });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.error ?? "Failed");
      const ins = j?.insight ?? null;
      onDone?.(ins);
    } catch (e:any) {
      console.error(e);
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button onClick={generate} disabled={loading} className={`px-4 py-2 rounded ${loading ? "bg-emerald-200" : "bg-emerald-600 text-white"}`}>
        {loading ? "Generating…" : "Generate insight"}
      </button>
      {err ? <div className="text-red-600 text-sm mt-2">{err}</div> : null}
    </div>
  );
}