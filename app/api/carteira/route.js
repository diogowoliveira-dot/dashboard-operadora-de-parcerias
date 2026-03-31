import { NextResponse } from 'next/server';
import sql from '../../lib/db';

export const dynamic = 'force-dynamic';

// POST /api/carteira → adiciona incorporadora à carteira
// body: { operadora_name, dev_value, dev_label, start_date }
export async function POST(req) {
  try {
    const { operadora_name, dev_value, dev_label, start_date } = await req.json();
    if (!operadora_name || !dev_value || !dev_label || !start_date)
      return NextResponse.json({ error: 'campos obrigatórios faltando' }, { status: 400 });

    await sql`
      INSERT INTO carteira (operadora_name, dev_value, dev_label, start_date)
      VALUES (${operadora_name}, ${dev_value}, ${dev_label}, ${start_date})
      ON CONFLICT (operadora_name, dev_value) DO UPDATE SET start_date = ${start_date}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/carteira → atualiza data de início
// body: { operadora_name, dev_value, start_date }
export async function PATCH(req) {
  try {
    const { operadora_name, dev_value, start_date } = await req.json();
    if (!operadora_name || !dev_value || !start_date)
      return NextResponse.json({ error: 'campos obrigatórios faltando' }, { status: 400 });

    await sql`
      UPDATE carteira SET start_date = ${start_date}
      WHERE operadora_name = ${operadora_name} AND dev_value = ${dev_value}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE /api/carteira?operadora_name=X&dev_value=Y → remove incorporadora
export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const operadora_name = searchParams.get('operadora_name');
    const dev_value = searchParams.get('dev_value');
    if (!operadora_name || !dev_value)
      return NextResponse.json({ error: 'campos obrigatórios faltando' }, { status: 400 });

    await sql`
      DELETE FROM carteira WHERE operadora_name = ${operadora_name} AND dev_value = ${dev_value}
    `;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
