import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../lib/db';
import { requireRole } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/onboarding/debug — master only, temporary debugging tool
export async function GET(req) {
  try {
    await initDb();
    const me = await requireRole(req, 'master');
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const onbRows = await sql`SELECT id, operadora_name, dev_value, dev_label, updated_at,
      (SELECT count(*) FROM jsonb_each(checks) WHERE value::text = 'true')::int AS checks_done,
      jsonb_object_keys(checks) IS NOT NULL AS has_checks,
      jsonb_typeof(checks) AS checks_type,
      checks,
      client_data
      FROM onboarding ORDER BY updated_at DESC`;

    const carteiraRows = await sql`SELECT id, operadora_name, dev_value, dev_label, start_date FROM carteira ORDER BY operadora_name, dev_value`;

    const operadorasRows = await sql`SELECT name FROM operadoras ORDER BY name`;

    return NextResponse.json({
      onboardingCount: onbRows.length,
      carteiraCount: carteiraRows.length,
      onboarding: onbRows,
      carteira: carteiraRows,
      operadoras: operadorasRows,
    });
  } catch (err) {
    console.error('[ONB DEBUG]', err);
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 });
  }
}
