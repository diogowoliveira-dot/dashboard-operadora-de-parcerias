import { NextResponse } from 'next/server';
import sql, { initDb } from '../../lib/db';
import { getSessionUser, generateToken } from '../../lib/auth';
import { sendEmail } from '../../lib/email';

export const dynamic = 'force-dynamic';

async function requireMaster(req) {
  const user = await getSessionUser(req);
  if (!user || user.role !== 'master') return null;
  return user;
}

// GET /api/users — list all users
export async function GET(req) {
  try {
    await initDb();
    const me = await requireMaster(req);
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const users = await sql`
      SELECT id, email, name, role, operadora_name, invite_token IS NOT NULL AS pending_invite, created_at
      FROM users ORDER BY created_at DESC
    `;
    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/users — invite a new operadora user
export async function POST(req) {
  try {
    await initDb();
    const me = await requireMaster(req);
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { email, operadora_name } = await req.json();
    if (!email || !operadora_name) {
      return NextResponse.json({ error: 'E-mail e operadora são obrigatórios' }, { status: 400 });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Upsert: if user already exists (e.g. re-invite), update token
    const existing = await sql`SELECT id FROM users WHERE email = ${email.toLowerCase().trim()}`;
    if (existing.length > 0) {
      await sql`
        UPDATE users
        SET operadora_name = ${operadora_name}, invite_token = ${token}, invite_expires_at = ${expiresAt}
        WHERE email = ${email.toLowerCase().trim()}
      `;
    } else {
      await sql`
        INSERT INTO users (email, role, operadora_name, invite_token, invite_expires_at)
        VALUES (${email.toLowerCase().trim()}, 'operadora', ${operadora_name}, ${token}, ${expiresAt})
      `;
    }

    const inviteUrl = `${process.env.APP_URL || 'https://dashboard-operadora-de-parcerias.vercel.app'}?invite=${token}`;

    await sendEmail({
      to: email,
      subject: 'Convite — DWV Parcerias',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>Você foi convidado</h2>
          <p>Você recebeu acesso ao dashboard DWV Parcerias para a operadora <strong>${operadora_name}</strong>.</p>
          <p>Clique no botão abaixo para criar seu perfil. O convite expira em 7 dias.</p>
          <a href="${inviteUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:6px">
            Aceitar convite
          </a>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/users — reassign operadora for a user
export async function PATCH(req) {
  try {
    await initDb();
    const me = await requireMaster(req);
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { id, operadora_name } = await req.json();
    if (!id || !operadora_name) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    await sql`UPDATE users SET operadora_name = ${operadora_name} WHERE id = ${id} AND role != 'master'`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/users — delete a user
export async function DELETE(req) {
  try {
    await initDb();
    const me = await requireMaster(req);
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    await sql`DELETE FROM users WHERE id = ${id} AND role != 'master'`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
