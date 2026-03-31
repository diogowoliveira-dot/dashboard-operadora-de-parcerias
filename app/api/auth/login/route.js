import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql, { initDb } from '../../../lib/db';
import { createSession, setCookieHeader } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    await initDb();
    const { email, password } = await req.json();
    if (!email || !password) return NextResponse.json({ error: 'Preencha todos os campos' }, { status: 400 });

    const rows = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase().trim()}`;
    const user = rows[0];

    if (!user || !user.password_hash) {
      return NextResponse.json({ error: 'E-mail ou senha inválidos' }, { status: 401 });
    }
    if (user.active === false) {
      return NextResponse.json({ error: 'Conta desativada. Entre em contato com o administrador.' }, { status: 403 });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return NextResponse.json({ error: 'E-mail ou senha inválidos' }, { status: 401 });

    const { token, expiresAt } = await createSession(user.id);

    const res = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role, operadora_name: user.operadora_name },
    });
    res.headers.set('Set-Cookie', setCookieHeader(token, expiresAt));
    return res;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
