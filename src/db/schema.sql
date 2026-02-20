CREATE TABLE IF NOT EXISTS fiscal_year (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  closed_at TEXT,
  opening_cash REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS period (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year_id INTEGER NOT NULL REFERENCES fiscal_year(id),
  name TEXT NOT NULL,
  started_at TEXT NOT NULL,
  closed_at TEXT,
  depreciation_booked REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS category (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('revenue', 'expense')),
  icon TEXT
);

CREATE TABLE IF NOT EXISTS "transaction" (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id INTEGER NOT NULL REFERENCES period(id),
  date TEXT NOT NULL,
  label TEXT NOT NULL,
  amount REAL NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('revenue', 'expense')),
  category_id INTEGER REFERENCES category(id),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS asset (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK(asset_type IN ('vehicle', 'implement', 'building', 'land')),
  purchase_price REAL NOT NULL,
  purchase_date TEXT NOT NULL,
  depreciation_years INTEGER,
  accumulated_depreciation REAL NOT NULL DEFAULT 0,
  from_lease_id INTEGER REFERENCES lease(id),
  sold_date TEXT,
  sold_price REAL
);

CREATE TABLE IF NOT EXISTS lease (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  total_value REAL NOT NULL,
  initial_payment REAL NOT NULL DEFAULT 0,
  monthly_payment REAL NOT NULL,
  duration_months INTEGER NOT NULL,
  residual_value REAL NOT NULL DEFAULT 0,
  start_date TEXT NOT NULL,
  payments_made INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'purchased', 'returned')),
  interest_rate REAL NOT NULL DEFAULT 0,
  remaining_balance REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS loan (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  principal REAL NOT NULL,
  interest_rate REAL NOT NULL,
  monthly_payment REAL NOT NULL,
  start_date TEXT NOT NULL,
  remaining_balance REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paid_off'))
);

CREATE TABLE IF NOT EXISTS loan_payment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  loan_id INTEGER NOT NULL REFERENCES loan(id),
  period_id INTEGER NOT NULL REFERENCES period(id),
  amount REAL NOT NULL,
  principal_part REAL NOT NULL,
  interest_part REAL NOT NULL,
  date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dividend (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fiscal_year_id INTEGER REFERENCES fiscal_year(id),
  total_amount REAL NOT NULL,
  per_share REAL NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('mandatory', 'manual')),
  date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS valuation_snapshot (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_id INTEGER REFERENCES period(id),
  date TEXT NOT NULL,
  cash REAL NOT NULL,
  total_asset_nbv REAL NOT NULL,
  total_debt REAL NOT NULL,
  total_lease_obligations REAL NOT NULL,
  valuation REAL NOT NULL,
  share_price REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
