import { NextResponse } from 'next/server';
import sql, { initDb } from '../../lib/db';
import { requireRole } from '../../lib/auth';

export const dynamic = 'force-dynamic';

function buildDates(startDate, recorrencia) {
  if (!recorrencia || recorrencia === 'nenhuma') return [startDate];
  const dates = [startDate];
  const base = new Date(startDate + 'T12:00:00');
  if (recorrencia === 'diaria') {
    for (let i = 1; i < 30; i++) {
      const d = new Date(base); d.setDate(d.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
  } else if (recorrencia === 'semanal') {
    for (let i = 1; i < 12; i++) {
      const d = new Date(base); d.setDate(d.getDate() + i * 7);
      dates.push(d.toISOString().split('T')[0]);
    }
  } else if (recorrencia === 'mensal') {
    for (let i = 1; i < 6; i++) {
      const d = new Date(base); d.setMonth(d.getMonth() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
  }
  return dates;
}

// GET /api/tarefas?operadora_name=X&year=Y&month=M
// GET /api/tarefas?operadora_name=X&start_date=Y&end_date=Z
// GET /api/tarefas?operadora_name=X&overdue=true
export async function GET(req) {
  try {
    await initDb();
    const me = await requireRole(req, 'master', 'admin', 'operadora');
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const operadora_name = searchParams.get('operadora_name') || me.operadora_name;

    if (me.role === 'operadora' && me.operadora_name !== operadora_name)
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    // Mode: overdue
    if (searchParams.get('overdue') === 'true') {
      const tasks = await sql`
        SELECT * FROM tarefas
        WHERE operadora_name = ${operadora_name}
          AND data < CURRENT_DATE
          AND status != 'concluida'
        ORDER BY data ASC, id ASC
      `;
      return NextResponse.json(tasks);
    }

    // Mode: explicit date range (week/day views)
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    if (startDate && endDate) {
      const tasks = await sql`
        SELECT * FROM tarefas
        WHERE operadora_name = ${operadora_name}
          AND data >= ${startDate} AND data <= ${endDate}
        ORDER BY data, hora NULLS LAST, id
      `;
      return NextResponse.json(tasks);
    }

    // Mode: month (default)
    const year = parseInt(searchParams.get('year') || new Date().getFullYear());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1));
    const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).toISOString().split('T')[0];

    const tasks = await sql`
      SELECT * FROM tarefas
      WHERE operadora_name = ${operadora_name}
        AND data >= ${firstDay} AND data <= ${lastDay}
      ORDER BY data, hora NULLS LAST, id
    `;
    return NextResponse.json(tasks);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/tarefas — suporta recorrencia (cria múltiplas) e attachments
export async function POST(req) {
  try {
    await initDb();
    const me = await requireRole(req, 'master', 'admin', 'operadora');
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { operadora_name, dev_value, dev_label, titulo, descricao, data, hora,
            prioridade, tipo, recorrencia, attachments } = await req.json();

    if (!operadora_name || !titulo || !data)
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 });

    if (me.role === 'operadora' && me.operadora_name !== operadora_name)
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const dates = buildDates(data, recorrencia);
    const attJson = JSON.stringify(attachments || []);
    const inserted = [];

    for (const d of dates) {
      const [row] = await sql`
        INSERT INTO tarefas
          (operadora_name, dev_value, dev_label, titulo, descricao, data, hora,
           prioridade, tipo, recorrencia, attachments)
        VALUES (
          ${operadora_name}, ${dev_value || null}, ${dev_label || null},
          ${titulo}, ${descricao || null}, ${d}, ${hora || null},
          ${prioridade || 'media'}, ${tipo || 'geral'},
          ${recorrencia || 'nenhuma'}, ${attJson}::jsonb
        )
        RETURNING *
      `;
      inserted.push(row);
    }

    return NextResponse.json(
      inserted.length === 1 ? inserted[0] : { ok: true, count: inserted.length }
    );
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/tarefas — atualização parcial com merge de campos
export async function PATCH(req) {
  try {
    await initDb();
    const me = await requireRole(req, 'master', 'admin', 'operadora');
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const body = await req.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

    const [task] = await sql`SELECT * FROM tarefas WHERE id = ${id}`;
    if (!task) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    if (me.role === 'operadora' && me.operadora_name !== task.operadora_name)
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const merged = {
      titulo:      body.titulo      !== undefined ? body.titulo      : task.titulo,
      descricao:   body.descricao   !== undefined ? body.descricao   : task.descricao,
      data:        body.data        !== undefined ? body.data        : task.data,
      hora:        'hora' in body   ? body.hora                      : task.hora,
      prioridade:  body.prioridade  !== undefined ? body.prioridade  : task.prioridade,
      tipo:        body.tipo        !== undefined ? body.tipo        : task.tipo,
      status:      body.status      !== undefined ? body.status      : task.status,
      dev_value:   'dev_value' in body ? body.dev_value             : task.dev_value,
      dev_label:   'dev_label' in body ? body.dev_label             : task.dev_label,
      attachments: 'attachments' in body ? body.attachments         : (task.attachments || []),
    };

    const [updated] = await sql`
      UPDATE tarefas SET
        titulo      = ${merged.titulo},
        descricao   = ${merged.descricao},
        data        = ${merged.data},
        hora        = ${merged.hora},
        prioridade  = ${merged.prioridade},
        tipo        = ${merged.tipo},
        status      = ${merged.status},
        dev_value   = ${merged.dev_value},
        dev_label   = ${merged.dev_label},
        attachments = ${JSON.stringify(merged.attachments)}::jsonb,
        updated_at  = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/tarefas?id=X
export async function DELETE(req) {
  try {
    await initDb();
    const me = await requireRole(req, 'master', 'admin', 'operadora');
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id obrigatório' }, { status: 400 });

    const [task] = await sql`SELECT * FROM tarefas WHERE id = ${id}`;
    if (!task) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
    if (me.role === 'operadora' && me.operadora_name !== task.operadora_name)
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    await sql`DELETE FROM tarefas WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
