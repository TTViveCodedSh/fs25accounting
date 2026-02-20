import { useDatabase } from '@/hooks/useDatabase'
import { getCashBalance, getTotalAssetsNBV, getTotalDebt, getTotalLeaseObligations, getNetProfit } from '@/lib/calculations'
import { getSetting, getCurrentFiscalYear } from '@/db/queries'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'

export function BalanceSheet() {
  const { db } = useDatabase()

  const cash = getCashBalance(db)
  const assetsNBV = getTotalAssetsNBV(db)
  const totalDebt = getTotalDebt(db)
  const leaseObligations = getTotalLeaseObligations(db)
  const capital = Number(getSetting(db, 'initial_capital') ?? '500000')
  const accLosses = Number(getSetting(db, 'accumulated_losses') ?? '0')

  const fy = getCurrentFiscalYear(db)
  const currentProfit = fy ? getNetProfit(db, fy.id) : 0

  // Assets side
  const totalActif = cash + assetsNBV

  // Liabilities & Equity side
  const totalPassif = capital + currentProfit - Math.abs(accLosses) + totalDebt + leaseObligations

  // Difference (should be 0 if balanced)
  const diff = Math.abs(totalActif - totalPassif)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Balance Sheet</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets */}
        <Card>
          <CardHeader>
            <CardTitle className="text-blue-600">Assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-muted-foreground uppercase">Fixed Assets</div>
              <div className="flex justify-between text-sm pl-2">
                <span>Net Fixed Assets (NBV)</span>
                <span className="font-medium">{formatCurrency(assetsNBV)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-muted-foreground uppercase">Current Assets</div>
              <div className="flex justify-between text-sm pl-2">
                <span>Cash</span>
                <span className="font-medium">{formatCurrency(cash)}</span>
              </div>
            </div>
            <div className="border-t-2 border-blue-200 dark:border-blue-800 pt-2 flex justify-between font-bold text-lg">
              <span>Total Assets</span>
              <span className="text-blue-600">{formatCurrency(totalActif)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Liabilities & Equity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-purple-600">Liabilities & Equity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="text-sm font-semibold text-muted-foreground uppercase">Equity</div>
              <div className="flex justify-between text-sm pl-2">
                <span>Share Capital</span>
                <span className="font-medium">{formatCurrency(capital)}</span>
              </div>
              {currentProfit !== 0 && (
                <div className="flex justify-between text-sm pl-2">
                  <span>Current Year Profit</span>
                  <span className={currentProfit >= 0 ? 'font-medium text-green-600' : 'font-medium text-red-600'}>
                    {formatCurrency(currentProfit)}
                  </span>
                </div>
              )}
              {accLosses !== 0 && (
                <div className="flex justify-between text-sm pl-2">
                  <span>Retained Losses</span>
                  <span className="font-medium text-red-600">-{formatCurrency(Math.abs(accLosses))}</span>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <div className="text-sm font-semibold text-muted-foreground uppercase">Liabilities</div>
              <div className="flex justify-between text-sm pl-2">
                <span>Loans</span>
                <span className="font-medium">{formatCurrency(totalDebt)}</span>
              </div>
              <div className="flex justify-between text-sm pl-2">
                <span>Lease Obligations</span>
                <span className="font-medium">{formatCurrency(leaseObligations)}</span>
              </div>
            </div>
            <div className="border-t-2 border-purple-200 dark:border-purple-800 pt-2 flex justify-between font-bold text-lg">
              <span>Total Liabilities & Equity</span>
              <span className="text-purple-600">{formatCurrency(totalPassif)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {diff > 1 && (
        <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <CardContent className="p-4 text-sm text-yellow-800 dark:text-yellow-200">
            Warning: balance sheet does not balance. Difference: {formatCurrency(diff)}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
