import { useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import {
  getFiscalYears,
  getPeriods,
  createPeriod,
  closePeriod,
  createFiscalYear,
  closeFiscalYear,
  getCurrentPeriod,
  getCurrentFiscalYear,
  getSetting,
  setSetting,
  sumTransactions,
  createDividend,
  createTransaction,
  createValuationSnapshot,
  bookPeriodDepreciation,
  processLeasePayments,
  getActiveAssets,
  getCategories,
  getMonthName,
} from '@/db/queries'
import { getCashBalance, getPeriodDepreciation, getValuation, getSharePrice, getTotalAssetsNBV, getTotalDebt, getTotalLeaseObligations } from '@/lib/calculations'
import { persistDatabase } from '@/db/database'
import { formatCurrency, todayISO } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Badge } from './ui/badge'
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog'
import { Calendar, Lock, Play, ChevronRight } from 'lucide-react'

export function Periods() {
  const { db, refresh } = useDatabase()
  const [closingWizard, setClosingWizard] = useState(false)
  const [closingStep, setClosingStep] = useState(0)
  const [dividendInput, setDividendInput] = useState('')

  const fiscalYears = getFiscalYears(db)
  const currentPeriod = getCurrentPeriod(db)
  const currentFY = getCurrentFiscalYear(db)

  const startMonth = parseInt(getSetting(db, 'start_month') ?? '8')

  async function handleOpenMonth() {
    if (!currentFY) return
    const periods = getPeriods(db, currentFY.id)
    const monthName = getMonthName(startMonth, periods.length)
    createPeriod(db, currentFY.id, monthName, todayISO())

    // Process automatic lease installments for the new month
    const allPeriods = getPeriods(db, currentFY.id)
    const newPeriod = allPeriods[allPeriods.length - 1]
    processLeasePayments(db, newPeriod.id, todayISO())

    await persistDatabase()
    refresh()
  }

  async function handleCloseMonth() {
    if (!currentPeriod || currentPeriod.closed_at) return

    // Book depreciation first so the snapshot reflects updated NBVs
    const depBooked = bookPeriodDepreciation(db)

    const cash = getCashBalance(db)
    const assetsNBV = getTotalAssetsNBV(db)
    const debt = getTotalDebt(db)
    const leaseObl = getTotalLeaseObligations(db)
    const val = getValuation(db)
    const sp = getSharePrice(db)
    createValuationSnapshot(db, currentPeriod.id, todayISO(), cash, assetsNBV, debt, leaseObl, val, sp)

    closePeriod(db, currentPeriod.id, todayISO(), depBooked)
    await persistDatabase()
    refresh()
  }

  function startYearEndClosing() {
    setClosingStep(0)
    const suggested = afterTax > 0 ? Math.round(afterTax * investorRatio * 100) / 100 : 0
    setDividendInput(suggested > 0 ? String(suggested) : '0')
    setClosingWizard(true)
  }

  // Year-end computed values
  const fyRevenue = currentFY ? sumTransactions(db, 'revenue', undefined, currentFY.id) : 0
  const fyExpenses = currentFY ? sumTransactions(db, 'expense', undefined, currentFY.id) : 0
  const bookedDepreciation = currentFY ? getPeriodDepreciation(db, currentFY.id) : 0

  // Project remaining depreciation for months not yet closed
  const fyPeriods = currentFY ? getPeriods(db, currentFY.id) : []
  const closedMonthCount = fyPeriods.filter((p) => p.closed_at).length
  const remainingMonthCount = 12 - closedMonthCount
  let projectedRemainingDep = 0
  if (remainingMonthCount > 0) {
    const activeAssets = getActiveAssets(db)
    for (const a of activeAssets) {
      if (!a.depreciation_years) continue
      const monthly = a.purchase_price / (a.depreciation_years * 12)
      const remaining = a.purchase_price - a.accumulated_depreciation
      if (remaining <= 0) continue
      projectedRemainingDep += Math.min(monthly * remainingMonthCount, remaining)
    }
  }

  const fyDepreciation = bookedDepreciation + projectedRemainingDep
  const fyNetProfit = fyRevenue - fyExpenses - fyDepreciation
  const accLosses = Number(getSetting(db, 'accumulated_losses') ?? '0')
  const taxRate = Number(getSetting(db, 'tax_rate') ?? '25') / 100

  // Tax: only on profit after absorbing accumulated losses
  const afterLosses = Math.max(fyNetProfit - accLosses, 0)
  const taxAmount = afterLosses > 0 ? Math.round(afterLosses * taxRate * 100) / 100 : 0
  const afterTax = afterLosses - taxAmount

  // Dividend: default = after-tax profit * investor share ratio (user can override, even at a loss)
  const totalShares = Number(getSetting(db, 'total_shares') ?? '5000')
  const investorShares = Number(getSetting(db, 'investor_shares') ?? '2500')
  const investorRatio = totalShares > 0 ? investorShares / totalShares : 0
  const suggestedDividend = afterTax > 0 ? Math.round(afterTax * investorRatio * 100) / 100 : 0

  const dividendAmount = parseFloat(dividendInput) || 0
  const clampedDividend = Math.max(dividendAmount, 0)

  async function finalizeYearEnd() {
    if (!currentFY) return

    // We need an open period to record transactions — open one if needed
    let periodForTx = currentPeriod
    if (!periodForTx) {
      const periods = getPeriods(db, currentFY.id)
      const monthName = getMonthName(startMonth, periods.length)
      createPeriod(db, currentFY.id, monthName, todayISO())
      periodForTx = { id: 0, fiscal_year_id: currentFY.id, name: monthName, started_at: todayISO(), closed_at: null, depreciation_booked: 0 }
      // Get the actual id
      const allPeriods = getPeriods(db, currentFY.id)
      periodForTx = allPeriods[allPeriods.length - 1]
    }

    // Update accumulated losses
    if (fyNetProfit < 0) {
      setSetting(db, 'accumulated_losses', String(accLosses + Math.abs(fyNetProfit)))
    } else if (fyNetProfit <= accLosses) {
      setSetting(db, 'accumulated_losses', String(accLosses - fyNetProfit))
    } else {
      setSetting(db, 'accumulated_losses', '0')
    }

    // Record corporate tax as an expense transaction
    if (taxAmount > 0) {
      const cats = getCategories(db, 'expense')
      const taxCat = cats.find((c) => c.name === 'Corporate Tax')
      createTransaction(db, periodForTx.id, todayISO(), 'Corporate Tax', taxAmount, 'expense', taxCat?.id ?? null, `Year-end tax: ${currentFY.name}`)
    }

    // Record dividend
    if (clampedDividend > 0) {
      const perShare = clampedDividend / totalShares
      createDividend(db, currentFY.id, clampedDividend, perShare, 'mandatory', todayISO())
    }

    // Book depreciation for all remaining months in the year
    const periods = getPeriods(db, currentFY.id)
    const closedMonths = periods.filter((p) => p.closed_at).length
    const remainingMonths = 12 - closedMonths

    // Close current period, booking remaining depreciation and lease payments
    const activePeriod = getPeriods(db, currentFY.id).find((p) => !p.closed_at)
    if (activePeriod) {
      const depBooked = remainingMonths > 0 ? bookPeriodDepreciation(db, remainingMonths) : 0
      if (remainingMonths > 0) processLeasePayments(db, activePeriod.id, todayISO(), remainingMonths)

      const cash = getCashBalance(db)
      const assetsNBV = getTotalAssetsNBV(db)
      const debt = getTotalDebt(db)
      const leaseObl = getTotalLeaseObligations(db)
      const val = getValuation(db)
      const sp = getSharePrice(db)
      createValuationSnapshot(db, activePeriod.id, todayISO(), cash, assetsNBV, debt, leaseObl, val, sp)
      closePeriod(db, activePeriod.id, todayISO(), depBooked)
    } else if (remainingMonths > 0) {
      bookPeriodDepreciation(db, remainingMonths)
    }

    closeFiscalYear(db, currentFY.id, todayISO())

    const newCash = getCashBalance(db)
    const yearNum = fiscalYears.length + 1
    createFiscalYear(db, `Year ${yearNum}`, todayISO(), newCash)

    const newFYs = getFiscalYears(db)
    const newFY = newFYs[newFYs.length - 1]
    createPeriod(db, newFY.id, getMonthName(startMonth, 0), todayISO())

    await persistDatabase()
    refresh()
    setClosingWizard(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Periods</h1>
        <div className="flex gap-2">
          {currentPeriod && !currentPeriod.closed_at && (
            <Button variant="outline" onClick={handleCloseMonth}>
              <Lock className="h-4 w-4" /> Close Month
            </Button>
          )}
          {currentFY && !currentPeriod && (
            <Button onClick={handleOpenMonth}>
              <Play className="h-4 w-4" /> Open Month
            </Button>
          )}
          {currentFY && (
            <Button variant="destructive" onClick={startYearEndClosing}>
              Year-End Closing
            </Button>
          )}
        </div>
      </div>

      {/* Timeline */}
      {fiscalYears.map((fy) => {
        const periods = getPeriods(db, fy.id)
        const isOpen = !fy.closed_at
        return (
          <Card key={fy.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-base">{fy.name}</CardTitle>
                </div>
                <Badge variant={isOpen ? 'success' : 'secondary'}>
                  {isOpen ? 'Open' : 'Closed'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {periods.map((p) => (
                  <div
                    key={p.id}
                    className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm ${
                      p.closed_at
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary/10 text-primary font-medium'
                    }`}
                  >
                    {!p.closed_at && <ChevronRight className="h-3 w-3" />}
                    {p.name}
                    {p.closed_at && <Lock className="h-3 w-3 ml-1" />}
                  </div>
                ))}
                {periods.length === 0 && (
                  <div className="text-sm text-muted-foreground">No periods</div>
                )}
              </div>
            </CardContent>
          </Card>
        )
      })}

      {/* Year-end closing wizard */}
      <Dialog open={closingWizard} onOpenChange={setClosingWizard}>
        <DialogHeader>
          <DialogTitle>Year-End Closing — {currentFY?.name}</DialogTitle>
          <DialogDescription>Summary and profit allocation</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {closingStep === 0 && (
            <div className="space-y-3">
              {/* P&L summary */}
              <div className="flex justify-between text-sm">
                <span>Total Revenue</span>
                <span className="text-positive font-medium">{formatCurrency(fyRevenue)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Total Expenses</span>
                <span className="text-negative font-medium">{formatCurrency(fyExpenses)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Depreciation</span>
                <span className="text-negative font-medium">{formatCurrency(fyDepreciation)}</span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Net Profit</span>
                <span className={fyNetProfit >= 0 ? 'text-positive' : 'text-negative'}>
                  {formatCurrency(fyNetProfit)}
                </span>
              </div>

              {accLosses > 0 && (
                <div className="flex justify-between text-sm text-warning">
                  <span>Accumulated Losses (carried forward)</span>
                  <span>-{formatCurrency(accLosses)}</span>
                </div>
              )}

              {accLosses > 0 && fyNetProfit > 0 && (
                <div className="flex justify-between text-sm">
                  <span>After absorbing losses</span>
                  <span className="font-medium">{formatCurrency(afterLosses)}</span>
                </div>
              )}

              {taxAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Corporate Tax ({(taxRate * 100).toFixed(0)}%)</span>
                  <span className="text-negative font-medium">-{formatCurrency(taxAmount)}</span>
                </div>
              )}

              {afterTax > 0 && (
                <div className="flex justify-between text-sm font-medium">
                  <span>After Tax</span>
                  <span>{formatCurrency(afterTax)}</span>
                </div>
              )}

              {fyNetProfit < 0 && (
                <div className="text-sm text-negative">
                  The loss of {formatCurrency(Math.abs(fyNetProfit))} will be carried forward.
                </div>
              )}

              {/* Dividend — always shown */}
              <div className="border-t pt-3 space-y-2">
                <Label>Dividends to Pay</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={dividendInput}
                  onChange={(e) => setDividendInput(e.target.value)}
                  placeholder="0"
                />
                {clampedDividend > 0 && totalShares > 0 && (
                  <div className="text-xs text-muted-foreground">
                    = {formatCurrency(clampedDividend / totalShares)} per share
                  </div>
                )}
                {afterTax > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Suggested: {formatCurrency(suggestedDividend)} ({(investorRatio * 100).toFixed(0)}% of after-tax profit)
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setClosingWizard(false)}>Cancel</Button>
                <Button onClick={() => setClosingStep(1)}>Next</Button>
              </div>
            </div>
          )}

          {closingStep === 1 && (
            <div className="space-y-4">
              <p className="text-sm font-medium">Closing summary:</p>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Net Profit</span>
                  <span className={fyNetProfit >= 0 ? 'text-positive' : 'text-negative'}>{formatCurrency(fyNetProfit)}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span>Corporate Tax</span>
                    <span className="text-negative">-{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                {clampedDividend > 0 && (
                  <div className="flex justify-between">
                    <span>Dividends</span>
                    <span className="text-negative">-{formatCurrency(clampedDividend)}</span>
                  </div>
                )}
                <div className="border-t pt-1 flex justify-between font-medium">
                  <span>Retained in company</span>
                  <span>{formatCurrency(fyNetProfit - taxAmount - clampedDividend)}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                The fiscal year will be closed and a new one opened.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setClosingStep(0)}>Back</Button>
                <Button variant="destructive" onClick={finalizeYearEnd}>Close Year</Button>
              </div>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  )
}
