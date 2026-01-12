// app/api/insights/get/route.ts
import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import prisma from "@/lib/prisma";
import { getEntriesForWeekByCreatedAt, computeWeekMoodStats } from "@/lib/insights";

async function getUserFromToken() {
  const token = await getSessionToken();
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  if (!data?.user) return null;
  return prisma.user.findUnique({ where: { supabaseId: data.user.id } });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const weekStart = url.searchParams.get("weekStart");
    if (!weekStart) return NextResponse.json({ error: "weekStart required" }, { status: 400 });

    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // find saved insight
    const saved = await prisma.weeklyInsight.findUnique({
      where: { userId_weekStart: { userId: user.id, weekStart } as any },
    });

    // compute stats from entries (same source as your generate flow uses)
    const { entries } = await getEntriesForWeekByCreatedAt(user.id, weekStart);
    const stats = computeWeekMoodStats(entries);

    return NextResponse.json({ ok: true, savedInsight: saved ?? null, stats });
  } catch (err: any) {
    console.error("insights/get error", err);
    return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
  }
}