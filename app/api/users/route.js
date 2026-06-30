import { NextResponse } from 'next/server';
import sql, { initDb } from '../../lib/db';
import { requireRole, generateToken } from '../../lib/auth';
import { sendEmail } from '../../lib/email';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.APP_URL || 'https://dashboard-operadora-de-parcerias.vercel.app';

// GET /api/users — master lista todos os usuários
export async function GET(req) {
  try {
    await initDb();
    const me = await requireRole(req, 'master');
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const users = await sql`
      SELECT id, email, name, role, operadora_name, active,
             invite_token IS NOT NULL AS pending_invite,
             created_at
      FROM users ORDER BY role ASC, created_at DESC
    `;
    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/users — master convida novo usuário (admin ou operadora)
export async function POST(req) {
  try {
    await initDb();
    const me = await requireRole(req, 'master');
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { email, role = 'operadora', operadora_name } = await req.json();
    if (!email) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 });
    if (role === 'operadora' && !operadora_name)
      return NextResponse.json({ error: 'Operadora é obrigatória para perfil operadora' }, { status: 400 });
    if (!['admin', 'operadora'].includes(role))
      return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 });

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const normalizedEmail = email.toLowerCase().trim();
    const opName = role === 'admin' ? null : operadora_name;

    const existing = await sql`SELECT id, role FROM users WHERE email = ${normalizedEmail}`;
    if (existing.length > 0) {
      if (existing[0].role === 'master')
        return NextResponse.json({ error: 'Não é possível reatribuir o master' }, { status: 400 });
      await sql`
        UPDATE users
        SET role = ${role}, operadora_name = ${opName},
            invite_token = ${token}, invite_expires_at = ${expiresAt}, active = TRUE
        WHERE email = ${normalizedEmail}
      `;
    } else {
      await sql`
        INSERT INTO users (email, role, operadora_name, invite_token, invite_expires_at)
        VALUES (${normalizedEmail}, ${role}, ${opName}, ${token}, ${expiresAt})
      `;
    }

    const inviteUrl = `${APP_URL}?invite=${token}`;
    const roleLabel = role === 'admin' ? 'Administrador' : `operadora ${opName}`;

    await sendEmail({
      to: email,
      subject: 'Convite — DWV Parcerias',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;color:#222">
          <div style="background:#111;padding:24px;border-radius:10px 10px 0 0;text-align:center">
            <div style="width:40px;height:40px;background:#E8392A;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:14px">DW</div>
          </div>
          <div style="border:1px solid #eee;border-top:none;padding:28px 32px;border-radius:0 0 10px 10px">
            <h2 style="margin:0 0 12px">Você foi convidado</h2>
            <p>Você recebeu acesso ao <strong>Dashboard DWV Parcerias</strong> como <strong>${roleLabel}</strong>.</p>
            <p>Clique no botão abaixo para criar sua senha e ativar seu acesso. O convite expira em <strong>7 dias</strong>.</p>
            <div style="text-align:center;margin:28px 0">
              <a href="${inviteUrl}" style="background:#E8392A;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block">
                Ativar minha conta
              </a>
            </div>
            <p style="color:#999;font-size:12px">Se você não esperava esse convite, pode ignorar este e-mail.</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/users — master: reassign, toggle-active
export async function PATCH(req) {
  try {
    await initDb();
    const me = await requireRole(req, 'master');
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const body = await req.json();
    const { id, action } = body;
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    if (action === 'toggle-active') {
      const rows = await sql`SELECT active, role FROM users WHERE id = ${id}`;
      if (!rows.length) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      if (rows[0].role === 'master') return NextResponse.json({ error: 'Não é possível desativar o master' }, { status: 400 });
      const newActive = !rows[0].active;
      await sql`UPDATE users SET active = ${newActive} WHERE id = ${id}`;
      // Invalidate sessions if deactivating
      if (!newActive) await sql`DELETE FROM sessions WHERE user_id = ${id}`;
      return NextResponse.json({ ok: true, active: newActive });
    }

    if (action === 'reassign') {
      const { operadora_name } = body;
      if (!operadora_name) return NextResponse.json({ error: 'Operadora obrigatória' }, { status: 400 });
      await sql`UPDATE users SET operadora_name = ${operadora_name} WHERE id = ${id} AND role = 'operadora'`;
      return NextResponse.json({ ok: true });
    }

    if (action === 'change-role') {
      const { role } = body;
      if (!['admin', 'operadora'].includes(role))
        return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 });
      // Admin não tem operadora — limpar o vínculo ao promover
      if (role === 'admin') {
        await sql`UPDATE users SET role = ${role}, operadora_name = NULL WHERE id = ${id} AND role != 'master'`;
      } else {
        await sql`UPDATE users SET role = ${role} WHERE id = ${id} AND role != 'master'`;
      }
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/users — master exclui usuário (não pode excluir master)
export async function DELETE(req) {
  try {
    await initDb();
    const me = await requireRole(req, 'master');
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    await sql`DELETE FROM sessions WHERE user_id = ${id}`;
    await sql`DELETE FROM users WHERE id = ${id} AND role != 'master'`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
