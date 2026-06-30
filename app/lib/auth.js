import sql from './db';

export const COOKIE_NAME = 'dwv_session';
export const SESSION_DAYS = 30;

export async function createSession(userId) {
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400 * 1000);
  await sql`INSERT INTO sessions (token, user_id, expires_at) VALUES (${token}, ${userId}, ${expiresAt})`;
  return { token, expiresAt };
}

export async function getSessionUser(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;\\s]+)`));
  if (!match) return null;
  const rows = await sql`
    SELECT u.id, u.email, u.name, u.role, u.operadora_name, u.active
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ${match[1]} AND s.expires_at > NOW() AND u.active = TRUE
  `;
  return rows[0] || null;
}

// Helper: requer que o usuário tenha um dos papéis informados
export async function requireRole(req, ...roles) {
  const user = await getSessionUser(req);
  if (!user || !roles.includes(user.role)) return null;
  return user;
}

export async function destroySession(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;\\s]+)`));
  if (match) await sql`DELETE FROM sessions WHERE token = ${match[1]}`;
}

export function generateToken() {
  return crypto.randomUUID().replace(/-/g, '') + Date.now().toString(36);
}

export function setCookieHeader(token, expiresAt) {
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Lax; Path=/; Expires=${expiresAt.toUTCString()}; Secure`;
}

export function clearCookieHeader() {
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0; Secure`;
}
