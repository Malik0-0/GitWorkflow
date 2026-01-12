// app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // your admin client

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password } = body;

    // Sign in using Supabase Admin / Auth SDK on the server
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return NextResponse.json({ error: error?.message || "Login failed" }, { status: 401 });
    }

    // session token (access token) that server can use to call supabaseAdmin.auth.getUser()
    const token = data.session.access_token;

    // create response and set httpOnly cookie
    const res = NextResponse.json({ ok: true });

    // set cookie (httpOnly so client JS can't read it)
    res.cookies.set({
      name: "cleannote_session",
      value: token,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production", // IMPORTANT: false in dev (localhost)
      maxAge: 60 * 60 * 24 * 30, // 30 days, adjust as needed
    });

    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}