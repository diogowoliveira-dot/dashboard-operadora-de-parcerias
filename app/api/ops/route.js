import { NextResponse } from 'next/server';
import sql, { initDb } from '../../lib/db';

export const dynamic = 'force-dynamic';

// GET /api/ops → retorna todas as operadoras com suas carteiras
export async function GET() {
  try {
    await initDb();
    const operadoras = await sql`SELECT name, email FROM operadoras ORDER BY created_at ASC`;
    const carteira = await sql`SELECT operadora_name, dev_value, dev_label, start_date::text FROM carteira ORDER BY created_at ASC`;

    const result = operadoras.map(op => ({
      name: op.name,
      email: op.email || '',
      devs: carteira
        .filter(c => c.operadora_name === op.name)
        .map(c => ({ value: c.dev_value, label: c.dev_label, startDate: c.start_date })),
    }));

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/ops → cria operadora { name }
export async function POST(req) {
  try {
    await initDb();
    const { name } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 });
    await sql`INSERT INTO operadoras (name) VALUES (${name.trim()}) ON CONFLICT (name) DO NOTHING`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/ops → atualiza e-mail da operadora { name, email }
export async function PATCH(req) {
  try {
    const { name, email } = await req.json();
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    await sql`UPDATE operadoras SET email = ${email || null} WHERE name = ${name}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/ops?name=X → remove operadora e sua carteira
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get('name');
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    await sql`DELETE FROM operadoras WHERE name = ${name}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
