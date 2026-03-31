import { NextResponse } from 'next/server';
import { destroySession, clearCookieHeader } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    await destroySession(req);
    const res = NextResponse.json({ ok: true });
    res.headers.set('Set-Cookie', clearCookieHeader());
    return res;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
