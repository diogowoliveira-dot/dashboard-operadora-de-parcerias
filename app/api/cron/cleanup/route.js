import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../lib/db';

export const dynamic = 'force-dynamic';

// GET /api/cron/cleanup — executado pelo Vercel Cron às 03:00 UTC diariamente
// Limpa sessões expiradas do banco para evitar acúmulo indefinido
export async function GET(req) {
  // Verifica CRON_SECRET enviado pelo Vercel (header Authorization: Bearer <secret>)
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await initDb();

    // Remove sessões expiradas
    const deleted = await sql`
      DELETE FROM sessions WHERE expires_at < NOW()
      RETURNING token
    `;

    // Remove invite_tokens e reset_tokens expirados (limpeza de segurança)
    await sql`
      UPDATE users
      SET invite_token = NULL, invite_expires_at = NULL
      WHERE invite_expires_at < NOW()
    `;
    await sql`
      UPDATE users
      SET reset_token = NULL, reset_expires_at = NULL
      WHERE reset_expires_at < NOW()
    `;

    console.log('[CRON cleanup] sessions deleted=%d', deleted.length);
    return NextResponse.json({
      ok: true,
      sessionsDeleted: deleted.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[CRON cleanup] error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
