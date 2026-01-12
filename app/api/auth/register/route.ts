import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import prisma from "@/lib/prisma";
import { setSessionCookie } from "@/lib/auth";

function passwordIsValid(pw: string) {
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(pw);
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    if (!passwordIsValid(password)) {
      return NextResponse.json({ error: "Password must be at least 8 characters and include letters and numbers." }, { status: 400 });
    }

    // Create user in Supabase
    const { data: createUserData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 });

    // Create Prisma user record
    const supabaseUser = createUserData.user!;
    await prisma.user.create({ data: { email: supabaseUser.email!, supabaseId: supabaseUser.id } });

    // Sign in
    const { data: sessionData, error: loginErr } = await supabaseAdmin.auth.signInWithPassword({ email, password });
    if (loginErr) return NextResponse.json({ error: loginErr.message }, { status: 400 });

    const token = sessionData.session?.access_token;
    if (token) await setSessionCookie(token);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}