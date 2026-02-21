import type { Database } from 'sql.js'
import type { Asset } from '@/db/queries'
import {
  getActiveAssets,
  getActiveLeases,
  getActiveLoans,
  getSetting,
  sumDepreciation,
  sumTransactions,
  totalAssetPurchases,
  totalAssetSales,
  totalDividendsPaid,
  totalLoanPrincipalPayments,
  totalLoanProceeds,
  totalLeaseCapitalOutflow,
} from '@/db/queries'

export function getDepreciation(asset: Asset): number {
  return asset.accumulated_depreciation
}

export function getNetBookValue(asset: Asset): number {
  return asset.purchase_price - asset.accumulated_depreciation
}

export function getTotalAssetsNBV(db: Database): number {
  const assets = getActiveAssets(db)
  return assets.reduce((sum, a) => sum + getNetBookValue(a), 0)
}

export function getTotalDebt(db: Database): number {
  const loans = getActiveLoans(db)
  return loans.reduce((sum, l) => sum + l.remaining_balance, 0)
}

export function getTotalLeaseObligations(db: Database): number {
  const leases = getActiveLeases(db)
  return leases.reduce((sum, l) => sum + l.remaining_balance, 0)
}

export function getCashBalance(db: Database): number {
  // Use initial capital as the starting point — all flows are tracked globally
  const initialCash = Number(getSetting(db, 'initial_capital') ?? '500000')

  // P&L items recorded as transactions (includes lease payments + loan interest)
  const revenue = sumTransactions(db, 'revenue')
  const expenses = sumTransactions(db, 'expense')

  // Balance sheet items NOT in transactions — handled here directly
  const assetPurchases = totalAssetPurchases(db)       // excludes leased assets
  const assetSales = totalAssetSales(db)
  const loanProceeds = totalLoanProceeds(db)
  const loanPrincipal = totalLoanPrincipalPayments(db)
  const dividends = totalDividendsPaid(db)

  // Lease capital outflows: down payments + capital portions + buyouts
  // (interest is already in expenses as transactions)
  const leaseCapital = totalLeaseCapitalOutflow(db)

  return (
    initialCash +
    revenue -
    expenses -
    assetPurchases +
    assetSales +
    loanProceeds -
    loanPrincipal -
    dividends -
    leaseCapital
  )
}

export function getValuation(db: Database): number {
  const cash = getCashBalance(db)
  const assetsNBV = getTotalAssetsNBV(db)
  const debt = getTotalDebt(db)
  const leaseObligations = getTotalLeaseObligations(db)
  return cash + assetsNBV - debt - leaseObligations
}

export function getSharePrice(db: Database): number {
  const totalShares = Number(getSetting(db, 'total_shares') ?? '5000')
  if (totalShares <= 0) return 0
  const valuation = getValuation(db)
  return valuation / totalShares
}

export function getPeriodDepreciation(db: Database, fiscalYearId?: number, periodId?: number): number {
  return sumDepreciation(db, fiscalYearId, periodId)
}

export function getNetProfit(db: Database, fiscalYearId: number): number {
  const revenue = sumTransactions(db, 'revenue', undefined, fiscalYearId)
  const expenses = sumTransactions(db, 'expense', undefined, fiscalYearId)
  const depreciation = getPeriodDepreciation(db, fiscalYearId)
  return revenue - expenses - depreciation
}

/** Minimum buyback price per share = initial share price * multiplier. */
export function getBuybackMinPrice(db: Database): number {
  const initialPrice = Number(getSetting(db, 'initial_share_price') ?? '100')
  const multiplier = Number(getSetting(db, 'buyback_multiplier') ?? '4')
  return initialPrice * multiplier
}

/** Effective buyback price = max(minimum buyback price, current share value). */
export function getBuybackEffectivePrice(db: Database): number {
  return Math.max(getBuybackMinPrice(db), getSharePrice(db))
}

