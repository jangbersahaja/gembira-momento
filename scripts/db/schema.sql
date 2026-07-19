-- Restocking advisory schema
-- Run via: npm run db:init

-- Stock levels captured automatically at shift clock-in / clock-out (via
-- StoreHub timesheets polling, see app/api/cron/capture-snapshots/route.ts)
CREATE TABLE IF NOT EXISTS stock_snapshots (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT NOT NULL,
  product_id TEXT,
  store_id TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('clock_in', 'clock_out', 'manual')),
  employee_id TEXT,
  shift_key TEXT NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sku, shift_key)
);

CREATE INDEX IF NOT EXISTS idx_stock_snapshots_sku_time
  ON stock_snapshots (sku, captured_at);

-- Historical + ongoing restocking activity (purchase orders, stock returns,
-- stock takes / manual corrections, and auto-detected shift stocking events).
-- Seeded once from CSV exports, and appended to automatically going forward.
CREATE TABLE IF NOT EXISTS restock_events (
  id BIGSERIAL PRIMARY KEY,
  sku TEXT NOT NULL,
  quantity NUMERIC NOT NULL, -- positive = stock added, negative = stock removed (returns)
  source TEXT NOT NULL CHECK (source IN ('purchase_order', 'stock_return', 'stock_take', 'manual', 'detected')),
  reference_id TEXT,
  supplier TEXT,
  cost NUMERIC,
  occurred_at TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (sku, source, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_restock_events_sku_time
  ON restock_events (sku, occurred_at);

-- Migration safety: widen the source CHECK constraint for databases created
-- before 'detected' existed (safe / idempotent to re-run).
ALTER TABLE restock_events DROP CONSTRAINT IF EXISTS restock_events_source_check;
ALTER TABLE restock_events ADD CONSTRAINT restock_events_source_check
  CHECK (source IN ('purchase_order', 'stock_return', 'stock_take', 'manual', 'detected'));

-- Dedupe table so the cron job never double-processes the same clock
-- in/out event across runs (StoreHub timesheets are polled on a rolling
-- lookback window).
CREATE TABLE IF NOT EXISTS processed_shift_events (
  shift_key TEXT PRIMARY KEY,
  employee_id TEXT,
  event_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
