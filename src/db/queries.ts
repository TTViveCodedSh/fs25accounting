import type { Database, SqlValue } from 'sql.js'
import { todayISO } from '@/lib/utils'

// --- Types ---

export interface FiscalYear {
  id: number
  name: string
  started_at: string
  closed_at: string | null
  opening_cash: number
}

export interface Period {
  id: number
  fiscal_year_id: number
  name: string
  started_at: string
  closed_at: string | null
  depreciation_booked: number
}

export interface Category {
  id: number
  name: string
  type: 'revenue' | 'expense'
  icon: string
}

export interface Transaction {
  id: number
  period_id: number
  date: string
  label: string
  amount: number
  type: 'revenue' | 'expense'
  category_id: number | null
  notes: string | null
}

export interface Asset {
  id: number
  name: string
  asset_type: 'vehicle' | 'implement' | 'building' | 'land'
  purchase_price: number
  purchase_date: string
  depreciation_years: number | null
  accumulated_depreciation: number
  from_lease_id: number | null
  sold_date: string | null
  sold_price: number | null
}

export interface Lease {
  id: number
  name: string
  total_value: number
  initial_payment: number
  monthly_payment: number
  duration_months: number
  residual_value: number
  start_date: string
  payments_made: number
  status: 'active' | 'purchased' | 'returned'
  interest_rate: number
  remaining_balance: number
}

export interface Loan {
  id: number
  name: string
  principal: number
  interest_rate: number
  monthly_payment: number
  start_date: string
  remaining_balance: number
  status: 'active' | 'paid_off'
}

export interface LoanPayment {
  id: number
  loan_id: number
  period_id: number
  amount: number
  principal_part: number
  interest_part: number
  date: string
}

export interface Dividend {
  id: number
  fiscal_year_id: number | null
  total_amount: number
  per_share: number
  type: 'mandatory' | 'manual'
  date: string
}

export interface ValuationSnapshot {
  id: number
  period_id: number | null
  date: string
  cash: number
  total_asset_nbv: number
  total_debt: number
  total_lease_obligations: number
  valuation: number
  share_price: number
}

// --- Helper ---

function queryAll<T>(db: Database, sql: string, params: SqlValue[] = []): T[] {
  const stmt = db.prepare(sql)
  try {
    stmt.bind(params)
    const results: T[] = []
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T)
    }
    return results
  } finally {
    stmt.free()
  }
}

function queryOne<T>(db: Database, sql: string, params: SqlValue[] = []): T | null {
  const results = queryAll<T>(db, sql, params)
  return results[0] ?? null
}

function exec(db: Database, sql: string, params: SqlValue[] = []): void {
  const stmt = db.prepare(sql)
  try {
    if (params.length > 0) stmt.bind(params)
    stmt.step()
  } finally {
    stmt.free()
  }
}

// --- Settings ---

export function getSetting(db: Database, key: string): string | null {
  const row = queryOne<{ value: string }>(db, `SELECT value FROM settings WHERE key = ?`, [key])
  return row?.value ?? null
}

export function setSetting(db: Database, key: string, value: string): void {
  exec(db, `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`, [key, value])
}

// --- Farm setup ---

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Get the month name for the Nth period (0-indexed) given a start_month (1-12). */
export function getMonthName(startMonth: number, periodIndex: number): string {
  return MONTH_NAMES[((startMonth - 1) + periodIndex) % 12]
}

export interface FarmConfig {
  saveName: string
  initialCapital: number
  totalShares: number
  investorShares: number
  taxRate: number
  depYearsVehicle: number
  depYearsImplement: number
  depYearsBuilding: number
  startMonth: number
  buybackMultiplier: number
}

export function initializeFarm(db: Database, config: FarmConfig): void {
  const today = todayISO()
  const farmShares = config.totalShares - config.investorShares
  const sharePrice = config.totalShares > 0 ? config.initialCapital / config.totalShares : 0

  const settings: [string, string][] = [
    ['save_name', config.saveName],
    ['initial_capital', String(config.initialCapital)],
    ['total_shares', String(config.totalShares)],
    ['investor_shares', String(config.investorShares)],
    ['farm_shares', String(farmShares)],
    ['initial_share_price', String(sharePrice)],
    ['buyback_multiplier', String(config.buybackMultiplier)],
    ['accumulated_losses', '0'],
    ['tax_rate', String(config.taxRate)],
    ['dep_years_vehicle', String(config.depYearsVehicle)],
    ['dep_years_implement', String(config.depYearsImplement)],
    ['dep_years_building', String(config.depYearsBuilding)],
    ['start_month', String(config.startMonth)],
    ['setup_complete', '1'],
  ]

  for (const [key, value] of settings) {
    setSetting(db, key, value)
  }

  // First fiscal year
  exec(db, `INSERT INTO fiscal_year (name, started_at, opening_cash) VALUES (?, ?, ?)`, [
    'Year 1', today, config.initialCapital,
  ])

  // Get the newly created fiscal year id
  const fy = queryOne<{ id: number }>(db, `SELECT last_insert_rowid() as id`)
  const fyId = fy?.id ?? 1

  // First period — named after the starting month
  const firstMonthName = getMonthName(config.startMonth, 0)
  exec(db, `INSERT INTO period (fiscal_year_id, name, started_at) VALUES (?, ?, ?)`, [
    fyId, firstMonthName, today,
  ])

  const period = queryOne<{ id: number }>(db, `SELECT last_insert_rowid() as id`)
  const periodId = period?.id ?? 1

  // Initial valuation snapshot
  exec(
    db,
    `INSERT INTO valuation_snapshot (period_id, date, cash, total_asset_nbv, total_debt, total_lease_obligations, valuation, share_price) VALUES (?, ?, ?, 0, 0, 0, ?, ?)`,
    [periodId, today, config.initialCapital, config.initialCapital, sharePrice],
  )
}

// --- Fiscal Years ---

export function getFiscalYears(db: Database): FiscalYear[] {
  return queryAll(db, `SELECT * FROM fiscal_year ORDER BY id`)
}

export function getCurrentFiscalYear(db: Database): FiscalYear | null {
  return queryOne(db, `SELECT * FROM fiscal_year WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1`)
}

export function createFiscalYear(db: Database, name: string, startedAt: string, openingCash: number): void {
  exec(db, `INSERT INTO fiscal_year (name, started_at, opening_cash) VALUES (?, ?, ?)`, [name, startedAt, openingCash])
}

export function closeFiscalYear(db: Database, id: number, closedAt: string): void {
  exec(db, `UPDATE fiscal_year SET closed_at = ? WHERE id = ?`, [closedAt, id])
}

// --- Periods ---

export function getPeriods(db: Database, fiscalYearId?: number): Period[] {
  if (fiscalYearId) {
    return queryAll(db, `SELECT * FROM period WHERE fiscal_year_id = ? ORDER BY id`, [fiscalYearId])
  }
  return queryAll(db, `SELECT * FROM period ORDER BY id`)
}

export function getCurrentPeriod(db: Database): Period | null {
  return queryOne(db, `SELECT * FROM period WHERE closed_at IS NULL ORDER BY id DESC LIMIT 1`)
}

export function createPeriod(db: Database, fiscalYearId: number, name: string, startedAt: string): void {
  exec(db, `INSERT INTO period (fiscal_year_id, name, started_at) VALUES (?, ?, ?)`, [fiscalYearId, name, startedAt])
}

export function closePeriod(db: Database, id: number, closedAt: string, depreciationBooked: number = 0): void {
  exec(db, `UPDATE period SET closed_at = ?, depreciation_booked = ? WHERE id = ?`, [closedAt, depreciationBooked, id])
}

// --- Categories ---

export function getCategories(db: Database, type?: 'revenue' | 'expense'): Category[] {
  if (type) {
    return queryAll(db, `SELECT * FROM category WHERE type = ? ORDER BY name`, [type])
  }
  return queryAll(db, `SELECT * FROM category ORDER BY type, name`)
}

export function createCategory(db: Database, name: string, type: 'revenue' | 'expense', icon: string): void {
  exec(db, `INSERT INTO category (name, type, icon) VALUES (?, ?, ?)`, [name, type, icon])
}

// --- Transactions ---

export function getTransactions(db: Database, periodId?: number): Transaction[] {
  if (periodId) {
    return queryAll(db, `SELECT * FROM "transaction" WHERE period_id = ? ORDER BY date DESC, id DESC`, [periodId])
  }
  return queryAll(db, `SELECT * FROM "transaction" ORDER BY date DESC, id DESC`)
}

export function getTransactionsByFiscalYear(db: Database, fiscalYearId: number): Transaction[] {
  return queryAll(
    db,
    `SELECT t.* FROM "transaction" t JOIN period p ON t.period_id = p.id WHERE p.fiscal_year_id = ? ORDER BY t.date DESC, t.id DESC`,
    [fiscalYearId],
  )
}

export function createTransaction(
  db: Database,
  periodId: number,
  date: string,
  label: string,
  amount: number,
  type: 'revenue' | 'expense',
  categoryId: number | null,
  notes: string | null,
): void {
  exec(
    db,
    `INSERT INTO "transaction" (period_id, date, label, amount, type, category_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [periodId, date, label, amount, type, categoryId, notes],
  )
}

export function deleteTransaction(db: Database, id: number): void {
  exec(db, `DELETE FROM "transaction" WHERE id = ?`, [id])
}

// --- Assets ---

export function getAssets(db: Database): Asset[] {
  return queryAll(db, `SELECT * FROM asset ORDER BY purchase_date DESC`)
}

export function getActiveAssets(db: Database): Asset[] {
  return queryAll(db, `SELECT * FROM asset WHERE sold_date IS NULL ORDER BY purchase_date DESC`)
}

export function createAsset(
  db: Database,
  name: string,
  assetType: 'vehicle' | 'implement' | 'building' | 'land',
  purchasePrice: number,
  purchaseDate: string,
  depreciationYears: number | null,
  fromLeaseId: number | null,
): void {
  exec(
    db,
    `INSERT INTO asset (name, asset_type, purchase_price, purchase_date, depreciation_years, from_lease_id) VALUES (?, ?, ?, ?, ?, ?)`,
    [name, assetType, purchasePrice, purchaseDate, depreciationYears, fromLeaseId],
  )
}

export function sellAsset(db: Database, id: number, soldDate: string, soldPrice: number): void {
  exec(db, `UPDATE asset SET sold_date = ?, sold_price = ? WHERE id = ?`, [soldDate, soldPrice, id])
}

export function setAssetDepreciation(db: Database, id: number, depreciationYears: number | null): void {
  exec(db, `UPDATE asset SET depreciation_years = ? WHERE id = ?`, [depreciationYears, id])
}

export function getAssetByLeaseId(db: Database, leaseId: number): Asset | null {
  return queryOne(db, `SELECT * FROM asset WHERE from_lease_id = ?`, [leaseId])
}

/** Book one month of depreciation for every active depreciable asset. Returns total booked. */
export function bookPeriodDepreciation(db: Database, months: number = 1): number {
  const assets = getActiveAssets(db)
  let total = 0
  for (const a of assets) {
    if (!a.depreciation_years) continue
    const monthly = a.purchase_price / (a.depreciation_years * 12)
    const remaining = a.purchase_price - a.accumulated_depreciation
    if (remaining <= 0) continue
    const amount = Math.min(monthly * months, remaining)
    exec(db, `UPDATE asset SET accumulated_depreciation = accumulated_depreciation + ? WHERE id = ?`, [amount, a.id])
    total += amount
  }
  return total
}

export function sumDepreciation(db: Database, fiscalYearId?: number, periodId?: number): number {
  if (periodId) {
    const row = queryOne<{ total: number }>(
      db,
      `SELECT COALESCE(SUM(depreciation_booked), 0) as total FROM period WHERE id = ?`,
      [periodId],
    )
    return row?.total ?? 0
  }
  if (fiscalYearId) {
    const row = queryOne<{ total: number }>(
      db,
      `SELECT COALESCE(SUM(depreciation_booked), 0) as total FROM period WHERE fiscal_year_id = ?`,
      [fiscalYearId],
    )
    return row?.total ?? 0
  }
  const row = queryOne<{ total: number }>(
    db,
    `SELECT COALESCE(SUM(depreciation_booked), 0) as total FROM period`,
  )
  return row?.total ?? 0
}

// --- Leases ---

export function getLeases(db: Database): Lease[] {
  return queryAll(db, `SELECT * FROM lease ORDER BY start_date DESC`)
}

export function getActiveLeases(db: Database): Lease[] {
  return queryAll(db, `SELECT * FROM lease WHERE status = 'active' ORDER BY start_date DESC`)
}

export function createLease(
  db: Database,
  name: string,
  totalValue: number,
  initialPayment: number,
  monthlyPayment: number,
  durationMonths: number,
  residualValue: number,
  startDate: string,
  interestRate: number = 0,
): number {
  const remainingBalance = totalValue - initialPayment
  exec(
    db,
    `INSERT INTO lease (name, total_value, initial_payment, monthly_payment, duration_months, residual_value, start_date, interest_rate, remaining_balance) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, totalValue, initialPayment, monthlyPayment, durationMonths, residualValue, startDate, interestRate, remainingBalance],
  )
  const row = queryOne<{ id: number }>(db, `SELECT last_insert_rowid() as id`)
  return row?.id ?? 0
}

export function recordLeasePayment(db: Database, id: number, capitalPortion: number): void {
  exec(db, `UPDATE lease SET payments_made = payments_made + 1, remaining_balance = remaining_balance - ? WHERE id = ?`, [capitalPortion, id])
}

export function purchaseLease(db: Database, id: number): void {
  exec(db, `UPDATE lease SET status = 'purchased', remaining_balance = 0 WHERE id = ?`, [id])
}

export function returnLease(db: Database, id: number): void {
  exec(db, `UPDATE lease SET status = 'returned' WHERE id = ?`, [id])
}

// --- Loans ---

export function getLoans(db: Database): Loan[] {
  return queryAll(db, `SELECT * FROM loan ORDER BY start_date DESC`)
}

export function getActiveLoans(db: Database): Loan[] {
  return queryAll(db, `SELECT * FROM loan WHERE status = 'active' ORDER BY start_date DESC`)
}

export function createLoan(
  db: Database,
  name: string,
  principal: number,
  interestRate: number,
  monthlyPayment: number,
  startDate: string,
): void {
  exec(
    db,
    `INSERT INTO loan (name, principal, interest_rate, monthly_payment, start_date, remaining_balance) VALUES (?, ?, ?, ?, ?, ?)`,
    [name, principal, interestRate, monthlyPayment, startDate, principal],
  )
}

export function recordLoanPayment(
  db: Database,
  loanId: number,
  periodId: number,
  amount: number,
  principalPart: number,
  interestPart: number,
  date: string,
): void {
  exec(
    db,
    `INSERT INTO loan_payment (loan_id, period_id, amount, principal_part, interest_part, date) VALUES (?, ?, ?, ?, ?, ?)`,
    [loanId, periodId, amount, principalPart, interestPart, date],
  )
  exec(db, `UPDATE loan SET remaining_balance = remaining_balance - ? WHERE id = ?`, [principalPart, loanId])

  // Check if paid off
  const loan = queryOne<Loan>(db, `SELECT * FROM loan WHERE id = ?`, [loanId])
  if (loan && loan.remaining_balance <= 0.01) {
    exec(db, `UPDATE loan SET status = 'paid_off', remaining_balance = 0 WHERE id = ?`, [loanId])
  }
}

export function getLoanPayments(db: Database, loanId: number): LoanPayment[] {
  return queryAll(db, `SELECT * FROM loan_payment WHERE loan_id = ? ORDER BY date DESC`, [loanId])
}

// --- Dividends ---

export function getDividends(db: Database): Dividend[] {
  return queryAll(db, `SELECT * FROM dividend ORDER BY date DESC`)
}

export function createDividend(
  db: Database,
  fiscalYearId: number | null,
  totalAmount: number,
  perShare: number,
  type: 'mandatory' | 'manual',
  date: string,
): void {
  exec(
    db,
    `INSERT INTO dividend (fiscal_year_id, total_amount, per_share, type, date) VALUES (?, ?, ?, ?, ?)`,
    [fiscalYearId, totalAmount, perShare, type, date],
  )
}

// --- Valuation Snapshots ---

export function getValuationSnapshots(db: Database): ValuationSnapshot[] {
  return queryAll(db, `SELECT * FROM valuation_snapshot ORDER BY date ASC`)
}

export function createValuationSnapshot(
  db: Database,
  periodId: number | null,
  date: string,
  cash: number,
  totalAssetNbv: number,
  totalDebt: number,
  totalLeaseObligations: number,
  valuation: number,
  sharePrice: number,
): void {
  exec(
    db,
    `INSERT INTO valuation_snapshot (period_id, date, cash, total_asset_nbv, total_debt, total_lease_obligations, valuation, share_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [periodId, date, cash, totalAssetNbv, totalDebt, totalLeaseObligations, valuation, sharePrice],
  )
}

// --- Aggregation helpers ---

export function sumTransactions(db: Database, type: 'revenue' | 'expense', periodId?: number, fiscalYearId?: number): number {
  if (fiscalYearId) {
    const row = queryOne<{ total: number }>(
      db,
      `SELECT COALESCE(SUM(t.amount), 0) as total FROM "transaction" t JOIN period p ON t.period_id = p.id WHERE t.type = ? AND p.fiscal_year_id = ?`,
      [type, fiscalYearId],
    )
    return row?.total ?? 0
  }
  if (periodId) {
    const row = queryOne<{ total: number }>(
      db,
      `SELECT COALESCE(SUM(amount), 0) as total FROM "transaction" WHERE type = ? AND period_id = ?`,
      [type, periodId],
    )
    return row?.total ?? 0
  }
  const row = queryOne<{ total: number }>(
    db,
    `SELECT COALESCE(SUM(amount), 0) as total FROM "transaction" WHERE type = ?`,
    [type],
  )
  return row?.total ?? 0
}

export function sumTransactionsByCategory(
  db: Database,
  type: 'revenue' | 'expense',
  fiscalYearId?: number,
  periodId?: number,
): { category_id: number; category_name: string; icon: string; total: number }[] {
  if (fiscalYearId) {
    return queryAll(
      db,
      `SELECT t.category_id, c.name as category_name, c.icon, SUM(t.amount) as total
       FROM "transaction" t
       JOIN period p ON t.period_id = p.id
       LEFT JOIN category c ON t.category_id = c.id
       WHERE t.type = ? AND p.fiscal_year_id = ?
       GROUP BY t.category_id ORDER BY total DESC`,
      [type, fiscalYearId],
    )
  }
  if (periodId) {
    return queryAll(
      db,
      `SELECT t.category_id, c.name as category_name, c.icon, SUM(t.amount) as total
       FROM "transaction" t
       LEFT JOIN category c ON t.category_id = c.id
       WHERE t.type = ? AND t.period_id = ?
       GROUP BY t.category_id ORDER BY total DESC`,
      [type, periodId],
    )
  }
  return queryAll(
    db,
    `SELECT t.category_id, c.name as category_name, c.icon, SUM(t.amount) as total
     FROM "transaction" t
     LEFT JOIN category c ON t.category_id = c.id
     WHERE t.type = ?
     GROUP BY t.category_id ORDER BY total DESC`,
    [type],
  )
}

export function totalDividendsPaid(db: Database): number {
  const row = queryOne<{ total: number }>(db, `SELECT COALESCE(SUM(total_amount), 0) as total FROM dividend`)
  return row?.total ?? 0
}

export function totalLoanProceeds(db: Database): number {
  const row = queryOne<{ total: number }>(db, `SELECT COALESCE(SUM(principal), 0) as total FROM loan`)
  return row?.total ?? 0
}

export function totalLoanPaymentsMade(db: Database): number {
  const row = queryOne<{ total: number }>(db, `SELECT COALESCE(SUM(amount), 0) as total FROM loan_payment`)
  return row?.total ?? 0
}

export function totalLoanPrincipalPayments(db: Database): number {
  const row = queryOne<{ total: number }>(db, `SELECT COALESCE(SUM(principal_part), 0) as total FROM loan_payment`)
  return row?.total ?? 0
}

/** Total non-P&L cash outflow from leases: down payments + capital portions of monthly payments + buyouts.
 *  Interest is already tracked as expense transactions, so not included here. */
export function totalLeaseCapitalOutflow(db: Database): number {
  const row = queryOne<{ total: number }>(
    db,
    `SELECT COALESCE(SUM(total_value - remaining_balance), 0) as total FROM lease`,
  )
  return row?.total ?? 0
}

export function totalAssetPurchases(db: Database): number {
  const row = queryOne<{ total: number }>(
    db,
    `SELECT COALESCE(SUM(purchase_price), 0) as total FROM asset WHERE from_lease_id IS NULL`,
  )
  return row?.total ?? 0
}

export function totalAssetSales(db: Database): number {
  const row = queryOne<{ total: number }>(
    db,
    `SELECT COALESCE(SUM(sold_price), 0) as total FROM asset WHERE sold_price IS NOT NULL`,
  )
  return row?.total ?? 0
}
