import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const APP_URL = 'https://dashboard-operadora-de-parcerias.vercel.app';
const MASTER_EMAIL = 'diogowoliveira@gmail.com';
const SECRET = 'dwv-setup-2026';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('secret') !== SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const sql = neon(process.env.dashboardoperadoraparcerias_DATABASE_URL);

    // ensure tables exist
    await sql`CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT,
      password_hash TEXT, role TEXT NOT NULL DEFAULT 'operadora',
      operadora_name TEXT, invite_token TEXT, invite_expires_at TIMESTAMPTZ,
      reset_token TEXT, reset_expires_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT NOW()
    )`;
    await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`;
    await sql`CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ DEFAULT NOW()
    )`;

    // generate invite token
    const token = crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // upsert master user
    const existing = await sql`SELECT id FROM users WHERE email = ${MASTER_EMAIL}`;
    if (existing.length > 0) {
      await sql`UPDATE users SET role = 'master', invite_token = ${token}, invite_expires_at = ${expiresAt}, active = TRUE WHERE email = ${MASTER_EMAIL}`;
    } else {
      await sql`INSERT INTO users (email, role, invite_token, invite_expires_at) VALUES (${MASTER_EMAIL}, 'master', ${token}, ${expiresAt})`;
    }

    const inviteUrl = `${APP_URL}?invite=${token}`;

    // send via SparkPost
    const emailRes = await fetch('https://api.sparkpost.com/api/v1/transmissions', {
      method: 'POST',
      headers: { 'Authorization': process.env.SPARKPOST_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipients: [{ address: { email: MASTER_EMAIL } }],
        content: {
          from: { email: 'noreply@mail.dwvapp.com.br', name: 'DWV Parcerias' },
          subject: 'Acesso Master — DWV Parcerias',
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:auto;color:#222">
              <div style="background:#111;padding:24px;border-radius:10px 10px 0 0;text-align:center">
                <div style="width:40px;height:40px;background:#E8392A;border-radius:8px;display:inline-flex;align-items:center;justify-content:center;font-weight:800;color:#fff;font-size:14px">DW</div>
              </div>
              <div style="border:1px solid #eee;border-top:none;padding:28px 32px;border-radius:0 0 10px 10px">
                <h2 style="margin:0 0 12px">Seu acesso Master está pronto</h2>
                <p>Clique no botão abaixo para criar sua senha e ativar o acesso <strong>Master</strong> ao Dashboard DWV Parcerias.</p>
                <p>O link expira em <strong>7 dias</strong>.</p>
                <div style="text-align:center;margin:28px 0">
                  <a href="${inviteUrl}" style="background:#E8392A;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px;display:inline-block">
                    Ativar conta Master
                  </a>
                </div>
                <p style="color:#999;font-size:12px;word-break:break-all">Link direto: ${inviteUrl}</p>
              </div>
            </div>
          `,
        },
      }),
    });

    const emailJson = await emailRes.json().catch(() => ({}));
    const emailOk = emailRes.ok;

    return NextResponse.json({ ok: true, email_sent: emailOk, invite_url: inviteUrl, email_response: emailJson });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
