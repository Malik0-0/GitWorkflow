import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) {
      return new NextResponse(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
    }
    return NextResponse.json({ ok: true, usersCount: data.length });
  } catch (err) {
    return new NextResponse(JSON.stringify({ ok: false, error: String(err) }), { status: 500 });
  }
}