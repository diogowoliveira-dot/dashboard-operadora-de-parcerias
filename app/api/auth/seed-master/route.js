import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql, { initDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

// One-time route to create the master user.
// Protected by MASTER_SEED_SECRET env var.
export async function POST(req) {
  try {
    const secret = req.headers.get('x-seed-secret');
    if (!secret || secret !== process.env.MASTER_SEED_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await initDb();

    const { email, password, name } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha obrigatórios' }, { status: 400 });
    }

    const existing = await sql`SELECT id FROM users WHERE role = 'master'`;
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Master já existe' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    await sql`
      INSERT INTO users (email, name, password_hash, role)
      VALUES (${email.toLowerCase().trim()}, ${name || 'Master'}, ${password_hash}, 'master')
    `;

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
