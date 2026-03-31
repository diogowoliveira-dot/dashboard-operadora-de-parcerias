import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql, { initDb } from '../../../lib/db';
import { createSession, setCookieHeader } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    await initDb();
    const { token, password } = await req.json();

    if (!token || !password) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ error: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 });
    }

    const rows = await sql`
      SELECT * FROM users
      WHERE reset_token = ${token} AND reset_expires_at > NOW()
    `;
    const user = rows[0];
    if (!user) {
      return NextResponse.json({ error: 'Link inválido ou expirado' }, { status: 400 });
    }

    const password_hash = await bcrypt.hash(password, 10);
    await sql`
      UPDATE users
      SET password_hash = ${password_hash}, reset_token = NULL, reset_expires_at = NULL
      WHERE id = ${user.id}
    `;

    const { token: sessionToken, expiresAt } = await createSession(user.id);
    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, operadora_name: user.operadora_name },
    });
    res.headers.set('Set-Cookie', setCookieHeader(sessionToken, expiresAt));
    return res;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
