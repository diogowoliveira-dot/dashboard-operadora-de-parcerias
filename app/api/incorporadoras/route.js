import { NextResponse } from 'next/server';
import { grafanaQuery, DS_POSTGRES } from '../../lib/grafana';
import { requireRole } from '../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const me = await requireRole(req, 'master', 'admin', 'operadora');
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });

  try {
    const { rows } = await grafanaQuery(
      DS_POSTGRES,
      'grafana-postgresql-datasource',
      `SELECT legacy_id AS value, concat(name, ' ', name_composition) as label
       FROM re_developers
       WHERE legacy_id IS NOT NULL
       ORDER BY name`
    );
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
