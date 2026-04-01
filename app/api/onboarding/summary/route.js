import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../lib/db';
import { requireRole } from '../../../lib/auth';

export const dynamic = 'force-dynamic';

// GET /api/onboarding/summary — master/admin only
// Returns all onboarding records joined with carteira start dates
export async function GET(req) {
  try {
    await initDb();
    const me = await requireRole(req, 'master', 'admin');
    if (!me) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });

    const rows = await sql`
      SELECT
        o.operadora_name,
        o.dev_value,
        o.dev_label,
        o.checks,
        o.client_data,
        o.updated_at,
        c.start_date
      FROM onboarding o
      LEFT JOIN carteira c
        ON c.operadora_name = o.operadora_name
        AND c.dev_value = o.dev_value::integer
      ORDER BY o.operadora_name, o.dev_label
    `;

    const TOTAL_TASKS = 48; // 30 DWV + 18 CLI

    const records = rows.map(r => {
      const checks = r.checks || {};
      const doneCnt = Object.values(checks).filter(Boolean).length;
      const pct = Math.round(doneCnt / TOTAL_TASKS * 100);

      // Prefer client-set inicio, fall back to carteira start_date
      const clientInicio = r.client_data?.inicio || null;
      const startDate = clientInicio || (r.start_date ? r.start_date.toISOString().split('T')[0] : null);
      const daysElapsed = startDate
        ? Math.floor((Date.now() - new Date(startDate + 'T12:00:00').getTime()) / 86400000)
        : null;

      return {
        operadora_name: r.operadora_name,
        dev_value: r.dev_value,
        dev_label: r.dev_label,
        pct,
        doneCnt,
        startDate,
        daysElapsed,
        overdue: daysElapsed !== null && daysElapsed > 30 && pct < 100,
        fase: r.client_data?.fase || 'ONBOARDING',
        updatedAt: r.updated_at,
      };
    });

    return NextResponse.json({ records });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
