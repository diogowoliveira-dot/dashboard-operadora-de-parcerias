import { NextResponse } from 'next/server';
import sql, { initDb } from '../../../lib/db';
import { generateToken } from '../../../lib/auth';
import { sendEmail } from '../../../lib/email';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  try {
    await initDb();
    const { email } = await req.json();
    if (!email) return NextResponse.json({ error: 'E-mail obrigatório' }, { status: 400 });

    const rows = await sql`SELECT * FROM users WHERE email = ${email.toLowerCase().trim()}`;
    const user = rows[0];

    // Always return ok to not reveal whether email exists
    if (!user || !user.password_hash) {
      return NextResponse.json({ ok: true });
    }

    const token = generateToken();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 hours

    await sql`
      UPDATE users SET reset_token = ${token}, reset_expires_at = ${expiresAt}
      WHERE id = ${user.id}
    `;

    const resetUrl = `${process.env.APP_URL || 'https://dashboard-operadora-de-parcerias.vercel.app'}?reset=${token}`;

    await sendEmail({
      to: user.email,
      subject: 'Recuperação de senha — DWV Parcerias',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2>Recuperação de senha</h2>
          <p>Olá${user.name ? `, ${user.name}` : ''}!</p>
          <p>Clique no botão abaixo para redefinir sua senha. O link expira em 2 horas.</p>
          <a href="${resetUrl}" style="display:inline-block;margin:16px 0;padding:12px 24px;background:#111;color:#fff;text-decoration:none;border-radius:6px">
            Redefinir senha
          </a>
          <p style="color:#888;font-size:12px">Se você não solicitou isso, ignore este e-mail.</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
