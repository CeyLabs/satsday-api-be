-- sats.day — full schema
-- Applied to Cloudflare D1: satsday (22b17f35-6fb6-4227-93db-fc89b216635a)

CREATE TABLE IF NOT EXISTS users (
  tg_user_id    INTEGER PRIMARY KEY,
  tg_username   TEXT,
  tg_first_name TEXT,
  tg_hash       TEXT NOT NULL,
  balance_sats  INTEGER NOT NULL DEFAULT 0,
  solved_count  INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  accuracy_pct  REAL NOT NULL DEFAULT 100.0,
  tier          TEXT NOT NULL DEFAULT 'standard',
  active        INTEGER NOT NULL DEFAULT 1,
  registered_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS buyers (
  api_key       TEXT PRIMARY KEY,
  tg_user_id    INTEGER REFERENCES users(tg_user_id),
  balance_sats  INTEGER NOT NULL DEFAULT 0,
  tier          TEXT NOT NULL DEFAULT 'starter',
  webhook_url   TEXT,
  created_at    INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id       TEXT PRIMARY KEY,
  api_key       TEXT REFERENCES buyers(api_key),
  status        TEXT NOT NULL DEFAULT 'queued',
  type          TEXT NOT NULL DEFAULT 'image',
  site_url      TEXT,
  site_key      TEXT,
  image_b64     TEXT,
  image_url     TEXT,
  solution      TEXT,
  cost_sats     INTEGER,
  assigned_to   INTEGER REFERENCES users(tg_user_id),
  created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  solved_at     INTEGER
);

CREATE TABLE IF NOT EXISTS payments (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_user_id          INTEGER REFERENCES users(tg_user_id),
  api_key             TEXT REFERENCES buyers(api_key),
  btcpay_invoice_id   TEXT UNIQUE,
  amount_sats         INTEGER NOT NULL,
  status              TEXT NOT NULL DEFAULT 'pending',
  type                TEXT NOT NULL DEFAULT 'deposit',
  created_at          INTEGER NOT NULL DEFAULT (unixepoch()),
  settled_at          INTEGER
);

CREATE TABLE IF NOT EXISTS ledger (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id       TEXT REFERENCES tasks(task_id),
  buyer_debit   INTEGER NOT NULL,
  solver_credit INTEGER NOT NULL,
  platform_fee  INTEGER NOT NULL,
  ts            INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_tasks_status    ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_api_key   ON tasks(api_key);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned  ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_tg     ON payments(tg_user_id);
