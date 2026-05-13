import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.dashboardoperadoraparcerias_DATABASE_URL);
export default sql;

// ── Guard: só roda as migrations uma vez por cold start ───────────────
let _dbReady = false;

export async function initDb() {
  if (_dbReady) return;

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
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL`;

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

  // ── Tabela: playbook_materiais ────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS playbook_materiais (
      id SERIAL PRIMARY KEY,
      titulo TEXT NOT NULL,
      descricao TEXT,
      tipo TEXT NOT NULL DEFAULT 'documento',
      url TEXT,
      ordem INTEGER NOT NULL DEFAULT 0,
      ativo BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  await sql`ALTER TABLE playbook_materiais ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT TRUE`;
  await sql`ALTER TABLE playbook_materiais ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()`;

  // ── Tabela: playbook_acessos ─────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS playbook_acessos (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      material_id INTEGER NOT NULL REFERENCES playbook_materiais(id) ON DELETE CASCADE,
      accessed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // ── Tabela: playbook_trilhas ─────────────────────────────────────────
  // ON DELETE SET NULL em created_by para não destruir trilhas ao remover gestor
  await sql`
    CREATE TABLE IF NOT EXISTS playbook_trilhas (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Migra constraint de CASCADE para SET NULL se tabela já existia
  await sql`
    DO $$ BEGIN
      ALTER TABLE playbook_trilhas DROP CONSTRAINT IF EXISTS playbook_trilhas_created_by_fkey;
      ALTER TABLE playbook_trilhas ADD CONSTRAINT playbook_trilhas_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
    EXCEPTION WHEN OTHERS THEN NULL;
    END $$
  `;

  // ── Tabela: playbook_trilha_materiais ────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS playbook_trilha_materiais (
      id SERIAL PRIMARY KEY,
      trilha_id INTEGER NOT NULL REFERENCES playbook_trilhas(id) ON DELETE CASCADE,
      material_id INTEGER NOT NULL REFERENCES playbook_materiais(id) ON DELETE CASCADE,
      ordem INTEGER NOT NULL DEFAULT 0,
      UNIQUE(trilha_id, material_id)
    )
  `;

  // ── Tabela: playbook_trilha_usuarios ─────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS playbook_trilha_usuarios (
      id SERIAL PRIMARY KEY,
      trilha_id INTEGER NOT NULL REFERENCES playbook_trilhas(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(trilha_id, user_id)
    )
  `;

  // ── Índices ──────────────────────────────────────────────────────────
  await sql`CREATE INDEX IF NOT EXISTS idx_carteira_operadora ON carteira(operadora_name)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_carteira_dev_value ON carteira(dev_value)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_onboarding_operadora ON onboarding(operadora_name)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_onboarding_dev_value ON onboarding(dev_value)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_operadora ON users(operadora_name)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_created_by ON users(created_by)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_invite_token ON users(invite_token) WHERE invite_token IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_playbook_acessos_user_material ON playbook_acessos(user_id, material_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_playbook_acessos_material ON playbook_acessos(material_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_playbook_materiais_ordem ON playbook_materiais(ordem)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_playbook_materiais_ativo ON playbook_materiais(ativo)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_playbook_trilhas_created_by ON playbook_trilhas(created_by)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_playbook_trilha_materiais_trilha ON playbook_trilha_materiais(trilha_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_playbook_trilha_usuarios_trilha ON playbook_trilha_usuarios(trilha_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_playbook_trilha_usuarios_user ON playbook_trilha_usuarios(user_id)`;

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
  await sql`
    DO $body$
    DECLARE tbl TEXT;
    BEGIN
      FOREACH tbl IN ARRAY ARRAY['operadoras','carteira','users','playbook_materiais','playbook_trilhas'] LOOP
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

  // ── Limpeza de sessões expiradas (só 1x por cold start) ──────────────
  await sql`DELETE FROM sessions WHERE expires_at < NOW()`;

  _dbReady = true;
}
