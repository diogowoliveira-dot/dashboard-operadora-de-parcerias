import { NextResponse } from 'next/server';
import sql, { initDb } from '../../lib/db';
import { getSessionUser } from '../../lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/onboarding?op=xxx&dev=yyy
export async function GET(req) {
  try {
    await initDb();
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const op = searchParams.get('op');
    const dev = searchParams.get('dev');
    if (!op || !dev) return NextResponse.json({ error: 'op e dev são obrigatórios' }, { status: 400 });

    // operadora users can only read their own operadora
    if (user.role === 'operadora' && user.operadora_name !== op) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const rows = await sql`
      SELECT checks, diag, client_data, tasks, notes, updated_at
      FROM onboarding
      WHERE operadora_name = ${op} AND dev_value = ${dev}
    `;

    if (!rows.length) return NextResponse.json({ data: null });

    const r = rows[0];
    return NextResponse.json({
      data: {
        checks: r.checks || {},
        diag: r.diag || {},
        client: r.client_data || {},
        tasks: r.tasks || [],
        notes: r.notes || '',
        updatedAt: r.updated_at,
      }
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/onboarding — upsert full state
export async function PUT(req) {
  try {
    await initDb();
    const user = await getSessionUser(req);
    if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

    const body = await req.json();
    const { op, dev, devLabel, checks = {}, diag = {}, client = {}, tasks = [], notes = '' } = body;
    if (!op || !dev) return NextResponse.json({ error: 'op e dev são obrigatórios' }, { status: 400 });

    // operadora users can only write their own operadora
    if (user.role === 'operadora' && user.operadora_name !== op) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const checkCount = Object.values(checks).filter(Boolean).length;
    console.log('[ONB PUT]', { op, dev, devLabel, checkCount, tasksLen: tasks.length });

    await sql`
      INSERT INTO onboarding (operadora_name, dev_value, dev_label, checks, diag, client_data, tasks, notes, updated_at)
      VALUES (${op}, ${String(dev)}, ${devLabel || null}, ${JSON.stringify(checks)}, ${JSON.stringify(diag)}, ${JSON.stringify(client)}, ${JSON.stringify(tasks)}, ${notes}, NOW())
      ON CONFLICT (operadora_name, dev_value)
      DO UPDATE SET
        dev_label = EXCLUDED.dev_label,
        checks = EXCLUDED.checks,
        diag = EXCLUDED.diag,
        client_data = EXCLUDED.client_data,
        tasks = EXCLUDED.tasks,
        notes = EXCLUDED.notes,
        updated_at = NOW()
    `;

    console.log('[ONB PUT] saved OK op=%s dev=%s checks=%d', op, dev, checkCount);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
