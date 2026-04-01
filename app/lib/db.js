import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.dashboardoperadoraparcerias_DATABASE_URL);
export default sql;

export async function initDb() {
  await sql`
    CREATE TABLE IF NOT EXISTS operadoras (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      email TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE operadoras ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS carteira (
      id SERIAL PRIMARY KEY,
      operadora_name TEXT NOT NULL REFERENCES operadoras(name) ON DELETE CASCADE,
      dev_value INTEGER NOT NULL,
      dev_label TEXT NOT NULL,
      start_date DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(operadora_name, dev_value)
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT,
      password_hash TEXT,
      role TEXT NOT NULL DEFAULT 'operadora',
      operadora_name TEXT,
      invite_token TEXT,
      invite_expires_at TIMESTAMPTZ,
      reset_token TEXT,
      reset_expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS onboarding (
      id SERIAL PRIMARY KEY,
      operadora_name TEXT NOT NULL,
      dev_value TEXT NOT NULL,
      dev_label TEXT,
      checks JSONB NOT NULL DEFAULT '{}',
      diag JSONB NOT NULL DEFAULT '{}',
      client_data JSONB NOT NULL DEFAULT '{}',
      tasks JSONB NOT NULL DEFAULT '[]',
      notes TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(operadora_name, dev_value)
    )
  `;
}
