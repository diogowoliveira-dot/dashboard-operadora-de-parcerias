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
        c.start_date,
        -- Return the canonical operadora name from the operadoras table (handles name mismatches)
        COALESCE(op.name, o.operadora_name) AS canonical_name
      FROM onboarding o
      LEFT JOIN carteira c
        ON LOWER(TRIM(c.operadora_name)) = LOWER(TRIM(o.operadora_name))
        AND CAST(c.dev_value AS TEXT) = o.dev_value
      LEFT JOIN operadoras op
        ON LOWER(TRIM(op.name)) = LOWER(TRIM(o.operadora_name))
      ORDER BY o.operadora_name, o.dev_label
    `;

    console.log('[ONB SUMMARY] rows=%d sample=%o', rows.length,
      rows[0] ? {
        op: rows[0].operadora_name,
        canonical: rows[0].canonical_name,
        dev: rows[0].dev_value,
        checksKeys: Object.keys(rows[0].checks || {}).length
      } : null
    );

    const TOTAL_TASKS = 48; // 30 DWV + 18 CLI

    const records = rows.map(r => {
      const checks = r.checks || {};
      // Be explicit about truthy values — handles both booleans and string coercions
      const doneCnt = Object.values(checks).filter(v => v === true || v === 1).length;
      const pct = Math.round(doneCnt / TOTAL_TASKS * 100);

      // Prefer client-set inicio, fall back to carteira start_date
      const clientInicio = r.client_data?.inicio || null;
      // start_date from Neon HTTP driver is already a "YYYY-MM-DD" string, not a Date object
      const rawStart = r.start_date
        ? (typeof r.start_date === 'string' ? r.start_date.slice(0, 10) : r.start_date.toISOString().slice(0, 10))
        : null;
      const startDate = clientInicio || rawStart;
      const daysElapsed = startDate
        ? Math.floor((Date.now() - new Date(startDate + 'T12:00:00').getTime()) / 86400000)
        : null;

      return {
        // Use canonical_name (from operadoras table) so DirView onbMap key matches op.name exactly
        operadora_name: r.canonical_name || r.operadora_name,
        stored_operadora_name: r.operadora_name, // keep original for debugging
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
