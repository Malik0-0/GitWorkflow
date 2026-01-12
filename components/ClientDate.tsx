// components/ClientDate.tsx
"use client";
import { useEffect, useState } from "react";

/**
 * ClientDate — formats an ISO string on the client only.
 * Renders nothing on the server (avoids hydration mismatch).
 *
 * Shows time by default (HH:MM), or you can change to toLocaleDateString if needed.
 */

export default function ClientDate({ iso }: { iso?: string | null }) {
  const [label, setLabel] = useState<string>(""); // start empty so SSR outputs nothing

  useEffect(() => {
    if (!iso) {
      setLabel("");
      return;
    }
    try {
      const d = new Date(iso);
      // Example: show date in consistent (day/month/year) style and time
      // Adjust options if you want different formatting (date-only, time-only, etc.)
      const dateStr = d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric" });
      const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
      setLabel(`${dateStr} ${timeStr}`);
    } catch (e) {
      setLabel(iso);
    }
  }, [iso]);

  // Render only the client-side label (empty on SSR)
  return <>{label}</>;
}
