import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ user: null }, { status: 401 });
    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
