import { NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  const token = await getSessionToken();
  if (!token) return NextResponse.json({ user: null });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error) return NextResponse.json({ user: null });
  return NextResponse.json({ user: data.user });
}