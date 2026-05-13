import { NextResponse } from 'next/server';
import sql, { initDb } from '../../lib/db';
import { getSessionUser, requireRole, generateToken } from '../../lib/auth';
import { sendEmail } from '../../lib/email';

export const dynamic = 'force-dynamic';

const APP_URL = process.env.APP_URL || 'https://dashboard-operadora-de-parcerias.vercel.app';

// GET /api/users — master lista todos, gestor (admin) lista os que criou
export async function GET(req) {
  try {
    await initDb();
    const me = await getSessionUser(req);
    if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    if (me.role === 'master') {
      const users = await sql`
        SELECT u.id, u.email, u.name, u.role, u.operadora_name, u.active,
               u.invite_token IS NOT NULL AS pending_invite,
               u.created_at, u.created_by,
               cb.name AS created_by_name
        FROM users u
        LEFT JOIN users cb ON cb.id = u.created_by
        ORDER BY u.role ASC, u.created_at DESC
      `;
      return NextResponse.json({ users });
    }

    if (me.role === 'admin') {
      // Gestores veem somente os users que criaram
      const users = await sql`
        SELECT id, email, name, role, operadora_name, active,
               invite_token IS NOT NULL AS pending_invite,
               created_at, created_by
        FROM users
        WHERE created_by = ${me.id}
        ORDER BY created_at DESC
      `;
      return NextResponse.json({ users });
    }

    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/users — master ou gestor convida novo usuário
export async function POST(req) {
  try {
    await initDb();
    const me = await getSessionUser(req);
    if (!me || !['master', 'admin'].includes(me.role))
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { email, role = 'operadora', operadora_name, name: inviteName } = await req.json();
    if (!email) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 });

    // Gestores só podem criar operadoras (usuários regulares)
    if (me.role === 'admin' && role !== 'operadora')
      return NextResponse.json({ error: 'Gestores só podem criar usuários regulares' }, { status: 400 });

    // Validação de role
    const allowedRoles = me.role === 'master' ? ['admin', 'operadora'] : ['operadora'];
    if (!allowedRoles.includes(role))
      return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 });

    if (role === 'operadora' && !operadora_name && me.role === 'master')
      return NextResponse.json({ error: 'Operadora é obrigatória para perfil operadora' }, { status: 400 });

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const normalizedEmail = email.toLowerCase().trim();
    const opName = role === 'admin' ? null : (operadora_name || me.operadora_name);

    const existing = await sql`SELECT id, role FROM users WHERE email = ${normalizedEmail}`;
    if (existing.length > 0) {
      if (existing[0].role === 'master')
        return NextResponse.json({ error: 'Não é possível reatribuir o master' }, { status: 400 });
      // Mantém created_by original se já existia (não transfere ownership)
      await sql`
        UPDATE users
        SET role = ${role}, operadora_name = ${opName},
            invite_token = ${token}, invite_expires_at = ${expiresAt},
            active = TRUE, created_by = COALESCE(created_by, ${me.id})
        WHERE email = ${normalizedEmail}
      `;
    } else {
      await sql`
        INSERT INTO users (email, name, role, operadora_name, invite_token, invite_expires_at, created_by)
        VALUES (${normalizedEmail}, ${inviteName || null}, ${role}, ${opName}, ${token}, ${expiresAt}, ${me.id})
      `;
    }

    const inviteUrl = `${APP_URL}?invite=${token}`;
    const roleLabel = role === 'admin' ? 'Gestor' : operadora_name ? `Operadora ${opName}` : 'Usuário';

    await sendEmail({
      to: email,
      subject: 'Bem-vindo ao Playbook DWV',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;color:#222">
          <div style="background:#111;padding:24px;border-radius:10px 10px 0 0;text-align:center">
            <div style="color:#E8392A;font-weight:800;font-size:20px">Playbook DWV</div>
          </div>
          <div style="border:1px solid #eee;border-top:none;padding:28px 32px;border-radius:0 0 10px 10px">
            <p>Ola <strong>${inviteName || email}</strong>,</p>
            <p>Sua conta foi criada no Playbook DWV — a central de materiais da equipe comercial.</p>
            <p>Clique no botao abaixo para criar sua senha e ativar seu acesso.</p>
            <div style="text-align:center;margin:28px 0">
              <a href="${inviteUrl}" style="background:#E8392A;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block">
                Acessar Playbook
              </a>
            </div>
            <p style="color:#999;font-size:12px">DWV — Gestao de Parcerias Imobiliarias</p>
          </div>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/users — master: any action. gestor: only users they created
export async function PATCH(req) {
  try {
    await initDb();
    const me = await getSessionUser(req);
    if (!me || !['master', 'admin'].includes(me.role))
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const body = await req.json();
    const { id, action } = body;
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    // Gestores só podem atuar em users que criaram
    if (me.role === 'admin') {
      const check = await sql`SELECT id FROM users WHERE id = ${id} AND created_by = ${me.id}`;
      if (!check.length) return NextResponse.json({ error: 'Acesso negado — usuário não pertence a você' }, { status: 403 });
    }

    if (action === 'toggle-active') {
      const rows = await sql`SELECT active, role FROM users WHERE id = ${id}`;
      if (!rows.length) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
      if (rows[0].role === 'master') return NextResponse.json({ error: 'Não é possível desativar o master' }, { status: 400 });
      const newActive = !rows[0].active;
      await sql`UPDATE users SET active = ${newActive} WHERE id = ${id}`;
      if (!newActive) await sql`DELETE FROM sessions WHERE user_id = ${id}`;
      return NextResponse.json({ ok: true, active: newActive });
    }

    if (action === 'reassign') {
      if (me.role !== 'master') return NextResponse.json({ error: 'Apenas master pode reatribuir' }, { status: 403 });
      const { operadora_name } = body;
      if (!operadora_name) return NextResponse.json({ error: 'Operadora obrigatória' }, { status: 400 });
      await sql`UPDATE users SET operadora_name = ${operadora_name} WHERE id = ${id} AND role = 'operadora'`;
      return NextResponse.json({ ok: true });
    }

    if (action === 'change-role') {
      if (me.role !== 'master') return NextResponse.json({ error: 'Apenas master pode mudar perfil' }, { status: 403 });
      const { role } = body;
      if (!['admin', 'operadora'].includes(role))
        return NextResponse.json({ error: 'Perfil inválido' }, { status: 400 });
      await sql`UPDATE users SET role = ${role} WHERE id = ${id} AND role != 'master'`;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação desconhecida' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/users — master deleta qualquer, gestor deleta só os seus
export async function DELETE(req) {
  try {
    await initDb();
    const me = await getSessionUser(req);
    if (!me || !['master', 'admin'].includes(me.role))
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    // Gestores só podem deletar users que criaram
    if (me.role === 'admin') {
      const check = await sql`SELECT id FROM users WHERE id = ${id} AND created_by = ${me.id} AND role != 'master'`;
      if (!check.length) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    await sql`DELETE FROM sessions WHERE user_id = ${id}`;
    await sql`DELETE FROM users WHERE id = ${id} AND role != 'master'`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
