import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.dashboardoperadoraparcerias_DATABASE_URL);
export default sql;

export async function initDb() {
  // ── Tabela: operadoras ────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS operadoras (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      email TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE operadoras ADD COLUMN IF NOT EXISTS email TEXT`;
  await sql`ALTER TABLE operadoras ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`;

  // ── Tabela: carteira ─────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS carteira (
      id SERIAL PRIMARY KEY,
      operadora_name TEXT NOT NULL REFERENCES operadoras(name) ON DELETE CASCADE ON UPDATE CASCADE,
      dev_value INTEGER NOT NULL,
      dev_label TEXT NOT NULL,
      start_date DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(operadora_name, dev_value)
    )
  `;
  await sql`ALTER TABLE carteira ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`;

  // ── Tabela: users ────────────────────────────────────────────────────
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
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`;

  // ── Tabela: sessions ─────────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // ── Tabela: onboarding ───────────────────────────────────────────────
  // dev_value é INTEGER para consistência com carteira.dev_value
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

  // ── Índices para performance ─────────────────────────────────────────
  await sql`CREATE INDEX IF NOT EXISTS idx_carteira_operadora ON carteira(operadora_name)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_carteira_dev_value ON carteira(dev_value)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_onboarding_operadora ON onboarding(operadora_name)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_onboarding_dev_value ON onboarding(dev_value)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_operadora ON users(operadora_name)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`;

  // ── Trigger: updated_at automático ───────────────────────────────────
  await sql`
    CREATE OR REPLACE FUNCTION _set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `;
  // Cria trigger para cada tabela (IF NOT EXISTS via verificação prévia)
  await sql`
    DO $body$
    DECLARE tbl TEXT;
    BEGIN
      FOREACH tbl IN ARRAY ARRAY['operadoras','carteira','users'] LOOP
        IF NOT EXISTS (
          SELECT 1 FROM pg_trigger t
          JOIN pg_class c ON c.oid = t.tgrelid
          WHERE t.tgname = 'trg_' || tbl || '_updated_at'
          AND c.relname = tbl
        ) THEN
          EXECUTE format(
            'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION _set_updated_at()',
            tbl, tbl
          );
        END IF;
      END LOOP;
    END
    $body$
  `;

  // ── Limpeza de sessões expiradas (custo zero, sem acumular lixo) ─────
  await sql`DELETE FROM sessions WHERE expires_at < NOW()`;
}
