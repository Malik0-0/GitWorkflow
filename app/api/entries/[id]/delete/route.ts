// app/api/entries/[id]/delete/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getSessionToken } from "@/lib/auth";

async function getCurrentPrismaUser() {
  const token = await getSessionToken();
  if (!token) return null;
  const { data } = await supabaseAdmin.auth.getUser(token);
  if (!data?.user) return null;
  return prisma.user.findUnique({ where: { supabaseId: data.user.id } });
}

export const runtime = "nodejs";

export async function DELETE(req: Request, context: { params: any }) {
  try {
    const params = await Promise.resolve(context.params);
    const id = params?.id;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const user = await getCurrentPrismaUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const entry = await prisma.entry.findUnique({ where: { id } });
    if (!entry || entry.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.entry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("delete entry error", err);
    return NextResponse.json({ error: err?.message || "Delete failed" }, { status: 500 });
  }
}