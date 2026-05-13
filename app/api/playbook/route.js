import { NextResponse } from 'next/server';
import sql, { initDb } from '../../lib/db';
import { getSessionUser } from '../../lib/auth';

export const dynamic = 'force-dynamic';

// Helper: master ou gestor (admin)
const isManagerOrMaster = (role) => ['master', 'admin'].includes(role);

// ─── GET /api/playbook ──────────────────────────────────────────────
export async function GET(req) {
  try {
    await initDb();
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action') || 'materiais';

    // ── Lista de materiais ativos (qualquer user logado) ──
    if (action === 'materiais') {
      const materiais = await sql`
        SELECT id, titulo, descricao, tipo, url, ordem, created_at
        FROM playbook_materiais WHERE ativo = TRUE
        ORDER BY ordem ASC, created_at ASC
      `;
      return NextResponse.json({ materiais });
    }

    // ── Meu progresso (qualquer user — para tela do usuário regular) ──
    if (action === 'meu-progresso') {
      const acessados = await sql`
        SELECT m.id, m.titulo, m.descricao, m.tipo, m.ordem,
               COUNT(*)::int AS vezes, MAX(pa.accessed_at) AS ultimo_acesso
        FROM playbook_acessos pa
        JOIN playbook_materiais m ON m.id = pa.material_id
        WHERE pa.user_id = ${user.id} AND m.ativo = TRUE
        GROUP BY m.id, m.titulo, m.descricao, m.tipo, m.ordem
        ORDER BY vezes DESC
      `;
      const faltam = await sql`
        SELECT m.id, m.titulo, m.descricao, m.tipo, m.ordem
        FROM playbook_materiais m
        WHERE m.ativo = TRUE AND m.id NOT IN (
          SELECT DISTINCT material_id FROM playbook_acessos WHERE user_id = ${user.id}
        )
        ORDER BY m.ordem ASC, m.created_at ASC
      `;
      const totalAcessos = acessados.reduce((s, a) => s + a.vezes, 0);
      return NextResponse.json({ acessados, faltam, total_acessos: totalAcessos });
    }

    // ── Minhas trilhas (qualquer user) ──
    if (action === 'minhas-trilhas') {
      const trilhas = await sql`
        SELECT t.id, t.nome, t.descricao, t.created_at,
               cb.name AS criado_por
        FROM playbook_trilha_usuarios tu
        JOIN playbook_trilhas t ON t.id = tu.trilha_id
        JOIN users cb ON cb.id = t.created_by
        WHERE tu.user_id = ${user.id}
        ORDER BY tu.assigned_at DESC
      `;
      // Para cada trilha, carregar materiais e progresso
      const result = [];
      for (const tr of trilhas) {
        const mats = await sql`
          SELECT tm.material_id, tm.ordem, m.titulo, m.descricao, m.tipo, m.url,
            (SELECT COUNT(*)::int FROM playbook_acessos WHERE user_id = ${user.id} AND material_id = m.id) AS vezes
          FROM playbook_trilha_materiais tm
          JOIN playbook_materiais m ON m.id = tm.material_id AND m.ativo = TRUE
          WHERE tm.trilha_id = ${tr.id}
          ORDER BY tm.ordem ASC
        `;
        const total = mats.length;
        const vistos = mats.filter(m => m.vezes > 0).length;
        result.push({ ...tr, materiais: mats, total, vistos });
      }
      return NextResponse.json({ trilhas: result });
    }

    // ── Tracking (master vê todos, gestor vê os que criou) ──
    if (action === 'tracking') {
      if (!isManagerOrMaster(user.role))
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

      const totalMateriais = await sql`
        SELECT COUNT(*)::int AS total FROM playbook_materiais WHERE ativo = TRUE
      `;

      let users;
      if (user.role === 'master') {
        users = await sql`
          SELECT u.id, u.name, u.email, u.role, u.operadora_name, u.active,
                 COALESCE(pa.total_acessos, 0)::int AS total_acessos,
                 COALESCE(pa.materiais_acessados, 0)::int AS materiais_acessados,
                 pa.ultimo_acesso, u.created_by,
                 cb.name AS created_by_name
          FROM users u
          LEFT JOIN (
            SELECT user_id, COUNT(*)::int AS total_acessos,
                   COUNT(DISTINCT material_id)::int AS materiais_acessados,
                   MAX(accessed_at) AS ultimo_acesso
            FROM playbook_acessos GROUP BY user_id
          ) pa ON pa.user_id = u.id
          LEFT JOIN users cb ON cb.id = u.created_by
          WHERE u.active = TRUE
          ORDER BY pa.total_acessos DESC NULLS LAST, u.name ASC
        `;
      } else {
        // Gestor vê apenas users que criou
        users = await sql`
          SELECT u.id, u.name, u.email, u.role, u.operadora_name, u.active,
                 COALESCE(pa.total_acessos, 0)::int AS total_acessos,
                 COALESCE(pa.materiais_acessados, 0)::int AS materiais_acessados,
                 pa.ultimo_acesso
          FROM users u
          LEFT JOIN (
            SELECT user_id, COUNT(*)::int AS total_acessos,
                   COUNT(DISTINCT material_id)::int AS materiais_acessados,
                   MAX(accessed_at) AS ultimo_acesso
            FROM playbook_acessos GROUP BY user_id
          ) pa ON pa.user_id = u.id
          WHERE u.active = TRUE AND u.created_by = ${user.id}
          ORDER BY pa.total_acessos DESC NULLS LAST, u.name ASC
        `;
      }

      return NextResponse.json({ total_materiais: totalMateriais[0]?.total || 0, users });
    }

    // ── Detalhe de um user (master ou gestor do user) ──
    if (action === 'user-detail') {
      if (!isManagerOrMaster(user.role))
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

      const userId = searchParams.get('id');
      if (!userId) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

      // Gestor só vê seus users
      if (user.role === 'admin') {
        const check = await sql`SELECT id FROM users WHERE id = ${userId} AND created_by = ${user.id}`;
        if (!check.length) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }

      const userInfo = await sql`SELECT id, name, email, role, operadora_name FROM users WHERE id = ${userId}`;
      if (!userInfo.length) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

      const acessados = await sql`
        SELECT m.id, m.titulo, m.descricao, m.tipo, m.ordem,
               COUNT(*)::int AS vezes, MAX(pa.accessed_at) AS ultimo_acesso
        FROM playbook_acessos pa
        JOIN playbook_materiais m ON m.id = pa.material_id
        WHERE pa.user_id = ${userId} AND m.ativo = TRUE
        GROUP BY m.id, m.titulo, m.descricao, m.tipo, m.ordem
        ORDER BY vezes DESC
      `;
      const faltam = await sql`
        SELECT m.id, m.titulo, m.descricao, m.tipo, m.ordem
        FROM playbook_materiais m
        WHERE m.ativo = TRUE AND m.id NOT IN (
          SELECT DISTINCT material_id FROM playbook_acessos WHERE user_id = ${userId}
        )
        ORDER BY m.ordem ASC, m.created_at ASC
      `;
      const totalAcessos = acessados.reduce((s, a) => s + a.vezes, 0);

      return NextResponse.json({
        user: userInfo[0], acessados, faltam,
        total_acessos: totalAcessos,
        materiais_acessados: acessados.length,
        materiais_faltam: faltam.length,
      });
    }

    // ── Listar trilhas (master vê todas, gestor vê as que criou) ──
    if (action === 'trilhas') {
      if (!isManagerOrMaster(user.role))
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

      const whereClause = user.role === 'master' ? sql`1=1` : sql`t.created_by = ${user.id}`;
      const trilhas = await sql`
        SELECT t.id, t.nome, t.descricao, t.created_at, t.created_by,
               cb.name AS criado_por,
               (SELECT COUNT(*)::int FROM playbook_trilha_materiais WHERE trilha_id = t.id) AS total_materiais,
               (SELECT COUNT(*)::int FROM playbook_trilha_usuarios WHERE trilha_id = t.id) AS total_usuarios
        FROM playbook_trilhas t
        JOIN users cb ON cb.id = t.created_by
        WHERE ${whereClause}
        ORDER BY t.created_at DESC
      `;
      return NextResponse.json({ trilhas });
    }

    // ── Detalhe de uma trilha ──
    if (action === 'trilha-detail') {
      if (!isManagerOrMaster(user.role))
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

      const trilhaId = searchParams.get('id');
      if (!trilhaId) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

      // Gestor só vê suas trilhas
      if (user.role === 'admin') {
        const check = await sql`SELECT id FROM playbook_trilhas WHERE id = ${trilhaId} AND created_by = ${user.id}`;
        if (!check.length) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }

      const trilha = await sql`
        SELECT t.id, t.nome, t.descricao, t.created_at, cb.name AS criado_por
        FROM playbook_trilhas t JOIN users cb ON cb.id = t.created_by
        WHERE t.id = ${trilhaId}
      `;
      if (!trilha.length) return NextResponse.json({ error: 'Não encontrada' }, { status: 404 });

      const materiais = await sql`
        SELECT tm.id AS tm_id, tm.ordem, m.id, m.titulo, m.descricao, m.tipo
        FROM playbook_trilha_materiais tm
        JOIN playbook_materiais m ON m.id = tm.material_id AND m.ativo = TRUE
        WHERE tm.trilha_id = ${trilhaId}
        ORDER BY tm.ordem ASC
      `;
      const usuarios = await sql`
        SELECT tu.id AS tu_id, u.id, u.name, u.email, u.role, tu.assigned_at
        FROM playbook_trilha_usuarios tu
        JOIN users u ON u.id = tu.user_id
        WHERE tu.trilha_id = ${trilhaId}
        ORDER BY tu.assigned_at DESC
      `;

      return NextResponse.json({ trilha: trilha[0], materiais, usuarios });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── POST /api/playbook ─────────────────────────────────────────────
export async function POST(req) {
  try {
    await initDb();
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── Criar material (master only) ──
    if (action === 'create-material') {
      if (user.role !== 'master')
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      const { titulo, descricao, tipo = 'documento', url, ordem = 0 } = body;
      if (!titulo) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 });
      const result = await sql`
        INSERT INTO playbook_materiais (titulo, descricao, tipo, url, ordem)
        VALUES (${titulo}, ${descricao || null}, ${tipo}, ${url || null}, ${ordem})
        RETURNING id
      `;
      return NextResponse.json({ ok: true, id: result[0].id });
    }

    // ── Registrar acesso (qualquer user) ──
    if (action === 'log-access') {
      const { material_id } = body;
      if (!material_id) return NextResponse.json({ error: 'material_id obrigatório' }, { status: 400 });
      await sql`INSERT INTO playbook_acessos (user_id, material_id) VALUES (${user.id}, ${material_id})`;
      return NextResponse.json({ ok: true });
    }

    // ── Criar trilha (master ou gestor) ──
    if (action === 'create-trilha') {
      if (!isManagerOrMaster(user.role))
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      const { nome, descricao, material_ids = [], user_ids = [] } = body;
      if (!nome) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 });

      const result = await sql`
        INSERT INTO playbook_trilhas (nome, descricao, created_by)
        VALUES (${nome}, ${descricao || null}, ${user.id})
        RETURNING id
      `;
      const trilhaId = result[0].id;

      // Adicionar materiais
      for (let i = 0; i < material_ids.length; i++) {
        await sql`
          INSERT INTO playbook_trilha_materiais (trilha_id, material_id, ordem)
          VALUES (${trilhaId}, ${material_ids[i]}, ${i + 1})
          ON CONFLICT (trilha_id, material_id) DO NOTHING
        `;
      }

      // Atribuir usuários
      for (const uid of user_ids) {
        await sql`
          INSERT INTO playbook_trilha_usuarios (trilha_id, user_id)
          VALUES (${trilhaId}, ${uid})
          ON CONFLICT (trilha_id, user_id) DO NOTHING
        `;
      }

      return NextResponse.json({ ok: true, id: trilhaId });
    }

    // ── Adicionar materiais a trilha ──
    if (action === 'trilha-add-materiais') {
      if (!isManagerOrMaster(user.role))
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      const { trilha_id, material_ids = [] } = body;
      if (!trilha_id) return NextResponse.json({ error: 'trilha_id obrigatório' }, { status: 400 });

      if (user.role === 'admin') {
        const check = await sql`SELECT id FROM playbook_trilhas WHERE id = ${trilha_id} AND created_by = ${user.id}`;
        if (!check.length) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }

      const existing = await sql`SELECT COALESCE(MAX(ordem),0)::int AS mx FROM playbook_trilha_materiais WHERE trilha_id = ${trilha_id}`;
      let ord = (existing[0]?.mx || 0) + 1;
      for (const mid of material_ids) {
        await sql`
          INSERT INTO playbook_trilha_materiais (trilha_id, material_id, ordem)
          VALUES (${trilha_id}, ${mid}, ${ord++})
          ON CONFLICT (trilha_id, material_id) DO NOTHING
        `;
      }
      return NextResponse.json({ ok: true });
    }

    // ── Atribuir usuários a trilha ──
    if (action === 'trilha-add-usuarios') {
      if (!isManagerOrMaster(user.role))
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      const { trilha_id, user_ids = [] } = body;
      if (!trilha_id) return NextResponse.json({ error: 'trilha_id obrigatório' }, { status: 400 });

      if (user.role === 'admin') {
        const check = await sql`SELECT id FROM playbook_trilhas WHERE id = ${trilha_id} AND created_by = ${user.id}`;
        if (!check.length) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }

      for (const uid of user_ids) {
        await sql`
          INSERT INTO playbook_trilha_usuarios (trilha_id, user_id)
          VALUES (${trilha_id}, ${uid})
          ON CONFLICT (trilha_id, user_id) DO NOTHING
        `;
      }
      return NextResponse.json({ ok: true });
    }

    // ── Remover material de trilha ──
    if (action === 'trilha-remove-material') {
      if (!isManagerOrMaster(user.role))
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      const { trilha_id, material_id } = body;
      if (user.role === 'admin') {
        const check = await sql`SELECT id FROM playbook_trilhas WHERE id = ${trilha_id} AND created_by = ${user.id}`;
        if (!check.length) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
      await sql`DELETE FROM playbook_trilha_materiais WHERE trilha_id = ${trilha_id} AND material_id = ${material_id}`;
      return NextResponse.json({ ok: true });
    }

    // ── Remover user de trilha ──
    if (action === 'trilha-remove-usuario') {
      if (!isManagerOrMaster(user.role))
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      const { trilha_id, user_id: targetId } = body;
      if (user.role === 'admin') {
        const check = await sql`SELECT id FROM playbook_trilhas WHERE id = ${trilha_id} AND created_by = ${user.id}`;
        if (!check.length) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
      await sql`DELETE FROM playbook_trilha_usuarios WHERE trilha_id = ${trilha_id} AND user_id = ${targetId}`;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── PATCH /api/playbook — atualizar material ou trilha ─────────────
export async function PATCH(req) {
  try {
    await initDb();
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await req.json();
    const { target } = body; // 'material' | 'trilha'

    if (target === 'trilha') {
      if (!isManagerOrMaster(user.role))
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      const { id, nome, descricao } = body;
      if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });
      if (user.role === 'admin') {
        const check = await sql`SELECT id FROM playbook_trilhas WHERE id = ${id} AND created_by = ${user.id}`;
        if (!check.length) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
      await sql`
        UPDATE playbook_trilhas
        SET nome = COALESCE(${nome ?? null}, nome),
            descricao = COALESCE(${descricao ?? null}, descricao),
            updated_at = NOW()
        WHERE id = ${id}
      `;
      return NextResponse.json({ ok: true });
    }

    // Default: material (master only)
    if (user.role !== 'master')
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { id, titulo, descricao, tipo, url, ordem, ativo } = body;
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    await sql`
      UPDATE playbook_materiais
      SET titulo = COALESCE(${titulo ?? null}, titulo),
          descricao = COALESCE(${descricao ?? null}, descricao),
          tipo = COALESCE(${tipo ?? null}, tipo),
          url = COALESCE(${url ?? null}, url),
          ordem = COALESCE(${ordem ?? null}, ordem),
          ativo = COALESCE(${ativo ?? null}, ativo),
          updated_at = NOW()
      WHERE id = ${id}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// ─── DELETE /api/playbook ───────────────────────────────────────────
export async function DELETE(req) {
  try {
    await initDb();
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const target = searchParams.get('target') || 'material';
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

    if (target === 'trilha') {
      if (!isManagerOrMaster(user.role))
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      if (user.role === 'admin') {
        const check = await sql`SELECT id FROM playbook_trilhas WHERE id = ${id} AND created_by = ${user.id}`;
        if (!check.length) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
      await sql`DELETE FROM playbook_trilhas WHERE id = ${id}`;
      return NextResponse.json({ ok: true });
    }

    // Material: master only (soft delete)
    if (user.role !== 'master')
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    await sql`UPDATE playbook_materiais SET ativo = FALSE, updated_at = NOW() WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
