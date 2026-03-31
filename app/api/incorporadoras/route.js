import { NextResponse } from 'next/server';
import { grafanaQuery, DS_POSTGRES } from '../../lib/grafana';

export async function GET() {
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
