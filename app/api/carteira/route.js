import { NextResponse } from 'next/server';
import sql, { initDb } from '../../lib/db';
import { requireRole } from '../../lib/auth';

export const dynamic = 'force-dynamic';

const ONBOARDING_TASKS = [
  { titulo: 'Kick-off de boas-vindas com a equipe', dias: 0 },
  { titulo: 'Envio de credenciais e acesso ao sistema', dias: 3 },
  { titulo: 'Treinamento da equipe comercial', dias: 7 },
  { titulo: 'Acompanhamento pós-treinamento', dias: 14 },
  { titulo: 'Revisão de metas — 1º mês', dias: 30 },
];

function addDays(baseDate, n) {
  const d = new Date(baseDate + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

// POST /api/carteira → adiciona incorporadora — master ou admin
export async function POST(req) {
  try {
    await initDb();
    const me = await requireRole(req, 'master', 'admin');
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { operadora_name, dev_value, dev_label, start_date } = await req.json();
    if (!operadora_name || !dev_value || !dev_label || !start_date)
      return NextResponse.json({ error: 'campos obrigatórios faltando' }, { status: 400 });

    const rows = await sql`
      INSERT INTO carteira (operadora_name, dev_value, dev_label, start_date)
      VALUES (${operadora_name}, ${dev_value}, ${dev_label}, ${start_date})
      ON CONFLICT (operadora_name, dev_value) DO UPDATE SET start_date = ${start_date}
      RETURNING (xmax = 0) AS inserted
    `;

    // Auto-cria tarefas de onboarding somente para novas entradas
    if (rows[0]?.inserted) {
      for (const t of ONBOARDING_TASKS) {
        await sql`
          INSERT INTO tarefas (operadora_name, dev_value, dev_label, titulo, data, prioridade, tipo)
          VALUES (
            ${operadora_name}, ${dev_value}, ${dev_label},
            ${t.titulo}, ${addDays(start_date, t.dias)},
            'media', 'onboarding'
          )
        `;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/carteira → atualiza data de início — master, admin ou operadora (só a própria carteira)
export async function PATCH(req) {
  try {
    const me = await requireRole(req, 'master', 'admin', 'operadora');
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { operadora_name, dev_value, start_date } = await req.json();
    if (!operadora_name || !dev_value || !start_date)
      return NextResponse.json({ error: 'campos obrigatórios faltando' }, { status: 400 });

    // Operadoras só podem editar a própria carteira
    if (me.role === 'operadora' && me.operadora_name !== operadora_name)
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    await sql`
      UPDATE carteira SET start_date = ${start_date}
      WHERE operadora_name = ${operadora_name} AND dev_value = ${dev_value}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/carteira?operadora_name=X&dev_value=Y — master ou admin
export async function DELETE(req) {
  try {
    const me = await requireRole(req, 'master', 'admin');
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const operadora_name = searchParams.get('operadora_name');
    const dev_value = searchParams.get('dev_value');
    if (!operadora_name || !dev_value)
      return NextResponse.json({ error: 'campos obrigatórios faltando' }, { status: 400 });

    await sql`DELETE FROM carteira WHERE operadora_name = ${operadora_name} AND dev_value = ${dev_value}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
