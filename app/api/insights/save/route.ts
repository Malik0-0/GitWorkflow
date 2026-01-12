// app/api/insights/save/route.ts
import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import prisma from "@/lib/prisma";

async function getUserFromToken() {
  const token = await getSessionToken();
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  if (!data?.user) return null;
  return prisma.user.findUnique({ where: { supabaseId: data.user.id } });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { weekStart, weekEnd, content, shortSummary } = body ?? {};
    if (!weekStart || !content) return NextResponse.json({ error: "weekStart and content required" }, { status: 400 });

    const user = await getUserFromToken();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let saved = null;
    try {
      saved = await prisma.weeklyInsight.upsert({
        where: { userId_weekStart: { userId: user.id, weekStart } as any },
        update: {
          content: typeof content === "string" ? content : JSON.stringify(content),
          weekEnd: weekEnd ?? undefined,
          shortSummary: shortSummary ?? undefined,
          generatedAt: new Date(),
        },
        create: {
          userId: user.id,
          weekStart,
          weekEnd: weekEnd ?? "",
          content: typeof content === "string" ? content : JSON.stringify(content),
          shortSummary: shortSummary ?? undefined,
        },
      });
    } catch (e) {
      // fallback to findFirst + update/create
      const existing = await prisma.weeklyInsight.findFirst({ where: { userId: user.id, weekStart } });
      if (existing) {
        saved = await prisma.weeklyInsight.update({
          where: { id: existing.id },
          data: {
            content: typeof content === "string" ? content : JSON.stringify(content),
            weekEnd: weekEnd ?? undefined,
            shortSummary: shortSummary ?? undefined,
            generatedAt: new Date(),
          },
        });
      } else {
        saved = await prisma.weeklyInsight.create({
          data: {
            userId: user.id,
            weekStart,
            weekEnd: weekEnd ?? "",
            content: typeof content === "string" ? content : JSON.stringify(content),
            shortSummary: shortSummary ?? undefined,
          },
        });
      }
    }

    return NextResponse.json({ ok: true, saved });
  } catch (err: any) {
    console.error("save insight error:", err);
    return NextResponse.json({ error: err.message ?? String(err) }, { status: 500 });
  }
}