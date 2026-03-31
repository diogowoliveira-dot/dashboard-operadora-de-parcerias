import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import sql, { initDb } from '../../../lib/db';
import { getSessionUser } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/auth/profile — retorna dados do usuário logado
export async function GET(req) {
  try {
    await initDb();
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/auth/profile — atualiza nome e/ou senha
export async function PATCH(req) {
  try {
    await initDb();
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { name, current_password, new_password } = await req.json();

    if (new_password) {
      if (new_password.length < 6)
        return NextResponse.json({ error: 'Nova senha deve ter pelo menos 6 caracteres' }, { status: 400 });

      const rows = await sql`SELECT password_hash FROM users WHERE id = ${user.id}`;
      const hash = rows[0]?.password_hash;
      if (!hash)
        return NextResponse.json({ error: 'Conta sem senha definida' }, { status: 400 });
      if (!current_password || !(await bcrypt.compare(current_password, hash)))
        return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 });

      const new_hash = await bcrypt.hash(new_password, 10);
      await sql`UPDATE users SET password_hash = ${new_hash} WHERE id = ${user.id}`;
    }

    if (name?.trim()) {
      await sql`UPDATE users SET name = ${name.trim()} WHERE id = ${user.id}`;
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
