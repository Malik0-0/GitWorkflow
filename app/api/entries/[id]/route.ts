// app/api/entries/[id]/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma"; // adjust if your import path differs

export async function PATCH(req: Request, ctx: any) {
  // ctx.params may be a Promise in this Next.js version — unwrap it
  const params = await ctx.params;
  const id = params?.id;
  console.log("[PATCH entries] id:", id);

  if (!id) {
    return NextResponse.json({ error: "Missing id param" }, { status: 400 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    console.error("[PATCH entries] invalid json", e);
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  console.log("[PATCH entries] raw body:", JSON.stringify(body));

  const allowed = [
    "titleRaw",
    "contentRaw",
    "titleTidied",
    "contentTidied",
    "moodLabel",
    "moodScore",
    "category",
    "dayDate",
    "dateManual",
    "moodManual",
    "categoryManual",
  ];

  const data: any = {};
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(body, k)) {
      data[k] = body[k];
    }
  }

  // dayDate -> JS Date or null
  if (Object.prototype.hasOwnProperty.call(data, "dayDate")) {
    const v = data.dayDate;
    if (v === null || v === "" || typeof v === "undefined") {
      data.dayDate = null;
    } else {
      const parsed = new Date(v);
      if (Number.isNaN(parsed.getTime())) {
        console.warn("[PATCH entries] invalid dayDate:", v);
        return NextResponse.json({ error: "Invalid dayDate; expected ISO datetime or null" }, { status: 400 });
      }
      data.dayDate = parsed;
    }
  }

  // moodScore -> number or null
  if (Object.prototype.hasOwnProperty.call(data, "moodScore")) {
    const ms = data.moodScore;
    if (ms === null || ms === "" || typeof ms === "undefined") data.moodScore = null;
    else data.moodScore = Number(ms);
  }

  // boolean flags
  ["dateManual", "moodManual", "categoryManual"].forEach((k) => {
    if (Object.prototype.hasOwnProperty.call(data, k)) {
      data[k] = !!data[k];
    }
  });

  console.log("[PATCH entries] sanitized update data:", JSON.stringify(data));

  try {
    const updated = await prisma.entry.update({
      where: { id },
      data,
    });
    console.log("[PATCH entries] updated result:", updated);
    return NextResponse.json({ ok: true, entry: updated });
  } catch (err: any) {
    console.error("[PATCH entries] prisma.update error:", err);
    return NextResponse.json({ error: err?.message || "Update failed" }, { status: 500 });
  }
}