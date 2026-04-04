-- sats.day database schema

CREATE TABLE IF NOT EXISTS buyers (
  api_key        TEXT PRIMARY KEY,
  balance_sats   INTEGER NOT NULL DEFAULT 0,
  tier           TEXT NOT NULL DEFAULT 'starter',  -- starter | growth | enterprise
  webhook_url    TEXT,
  created_at     INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id        TEXT PRIMARY KEY,
  api_key        TEXT NOT NULL REFERENCES buyers(api_key),
  status         TEXT NOT NULL DEFAULT 'queued',   -- queued | assigned | solved | failed
  type           TEXT NOT NULL DEFAULT 'image',    -- image | text | recaptcha | hcaptcha
  image_url      TEXT,
  image_b64      TEXT,
  solution       TEXT,
  cost_sats      INTEGER,
  assigned_to    INTEGER,                          -- tg_user_id of solver
  created_at     INTEGER NOT NULL DEFAULT (unixepoch()),
  solved_at      INTEGER
);

CREATE TABLE IF NOT EXISTS solvers (
  tg_user_id     INTEGER PRIMARY KEY,
  tg_username    TEXT,
  balance_sats   INTEGER NOT NULL DEFAULT 0,
  solved_count   INTEGER NOT NULL DEFAULT 0,
  correct_count  INTEGER NOT NULL DEFAULT 0,
  accuracy_pct   REAL NOT NULL DEFAULT 100.0,
  tier           TEXT NOT NULL DEFAULT 'standard', -- standard | premium
  active         INTEGER NOT NULL DEFAULT 1,
  registered_at  INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS ledger (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id        TEXT NOT NULL REFERENCES tasks(task_id),
  buyer_debit    INTEGER NOT NULL,
  solver_credit  INTEGER NOT NULL,
  platform_fee   INTEGER NOT NULL,
  ts             INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tasks_status   ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_api_key  ON tasks(api_key);
CREATE INDEX IF NOT EXISTS idx_ledger_task    ON ledger(task_id);
