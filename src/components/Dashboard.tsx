import { useDatabase } from '@/hooks/useDatabase'
import { getCashBalance, getSharePrice, getValuation, getPeriodDepreciation } from '@/lib/calculations'
import { getCurrentPeriod, getTransactions, getValuationSnapshots, sumTransactions, getCurrentFiscalYear, getPeriods, getFiscalYears } from '@/db/queries'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Select } from './ui/select'
import { Label } from './ui/label'
import { TrendingUp, TrendingDown, Wallet, BarChart3, PieChart, Calendar } from 'lucide-react'
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, ComposedChart, ReferenceLine } from 'recharts'
import { useNavigate } from 'react-router-dom'
import { Button } from './ui/button'
import { CHART_TOOLTIP_STYLE } from '@/lib/chartConfig'
import { useState } from 'react'

export function Dashboard() {
  const { db } = useDatabase()
  const navigate = useNavigate()

  const cash = getCashBalance(db)
  const sharePrice = getSharePrice(db)
  const valuation = getValuation(db)
  const period = getCurrentPeriod(db)
  const fy = getCurrentFiscalYear(db)
  const snapshots = getValuationSnapshots(db)
  const fiscalYears = getFiscalYears(db)

  const lastSnapshot = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null
  const priceChange = lastSnapshot && lastSnapshot.share_price > 0 ? ((sharePrice - lastSnapshot.share_price) / lastSnapshot.share_price) * 100 : 0

  // Chart fiscal year selector
  const [chartFYId, setChartFYId] = useState<number>(fy?.id ?? fiscalYears[fiscalYears.length - 1]?.id ?? 0)
  const chartPeriods = chartFYId ? getPeriods(db, chartFYId) : []

  // Per-period data for the selected FY
  const periodChartData = chartPeriods.map((p) => {
    const revenue = sumTransactions(db, 'revenue', p.id)
    const expenses = sumTransactions(db, 'expense', p.id)
    const depreciation = getPeriodDepreciation(db, undefined, p.id)
    const profit = revenue - expenses - depreciation
    return { name: p.name, revenue, expenses, depreciation, profit }
  })

  // Yearly totals for the selected FY
  const yearRevenue = periodChartData.reduce((s, d) => s + d.revenue, 0)
  const yearExpenses = periodChartData.reduce((s, d) => s + d.expenses, 0)
  const yearDepreciation = periodChartData.reduce((s, d) => s + d.depreciation, 0)
  const yearProfit = yearRevenue - yearExpenses - yearDepreciation

  // Cash position from valuation snapshots
  const cashHistory = snapshots.map((s, i) => ({
    label: `#${i + 1}`,
    cash: Math.round(s.cash),
    valuation: Math.round(s.valuation),
  }))

  // Share price history
  const priceHistory = snapshots.map((s) => ({
    date: s.date,
    price: Math.round(s.share_price),
  }))

  // Recent transactions
  const allTransactions = period ? getTransactions(db, period.id) : []
  const recent = allTransactions.slice(0, 10)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cash</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${cash >= 0 ? 'text-positive' : 'text-negative'}`}>
              {formatCurrency(cash)}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Share Price</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(sharePrice)}</div>
            {priceChange !== 0 && (
              <div className={`flex items-center gap-1 text-xs ${priceChange > 0 ? 'text-positive' : 'text-negative'}`}>
                {priceChange > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {priceChange > 0 ? '+' : ''}{priceChange.toFixed(1)}%
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valuation</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(valuation)}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Current Period</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{period?.name ?? '—'}</div>
            <div className="text-xs text-muted-foreground">{fy?.name ?? ''}</div>
          </CardContent>
        </Card>
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => navigate('/transactions')} size="sm">New Transaction</Button>
        <Button onClick={() => navigate('/assets')} variant="outline" size="sm">Buy Asset</Button>
        <Button onClick={() => navigate('/leases')} variant="outline" size="sm">New Lease</Button>
        <Button onClick={() => navigate('/loans')} variant="outline" size="sm">New Loan</Button>
      </div>

      {/* Yearly totals */}
      <div className="flex items-center gap-4">
        <Label>Fiscal Year:</Label>
        <Select
          value={String(chartFYId)}
          onChange={(e) => setChartFYId(Number(e.target.value))}
          className="w-40"
        >
          {fiscalYears.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-medium text-muted-foreground uppercase">Total Revenue</div>
            <div className="text-xl font-bold text-positive">{formatCurrency(yearRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-medium text-muted-foreground uppercase">Total Expenses</div>
            <div className="text-xl font-bold text-negative">{formatCurrency(yearExpenses)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-medium text-muted-foreground uppercase">Depreciation</div>
            <div className="text-xl font-bold text-warning">{formatCurrency(yearDepreciation)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-xs font-medium text-muted-foreground uppercase">Net Profit</div>
            <div className={`text-xl font-bold ${yearProfit >= 0 ? 'text-positive' : 'text-negative'}`}>
              {yearProfit >= 0 ? '+' : ''}{formatCurrency(yearProfit)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row 1: Monthly P&L + Cash position */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Monthly Profit & Loss</CardTitle>
          </CardHeader>
          <CardContent>
            {periodChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={periodChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" fontSize={12} tick={{ fill: 'var(--color-muted-foreground)' }} />
                  <YAxis fontSize={12} tick={{ fill: 'var(--color-muted-foreground)' }} />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v))}
                    contentStyle={CHART_TOOLTIP_STYLE}
                  />
                  <ReferenceLine y={0} stroke="var(--color-muted-foreground)" strokeDasharray="3 3" />
                  <Bar dataKey="revenue" name="Revenue" fill="var(--color-chart-2)" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="expenses" name="Expenses" fill="var(--color-destructive)" radius={[2, 2, 0, 0]} />
                  <Line type="monotone" dataKey="profit" name="Profit" stroke="var(--color-chart-4)" strokeWidth={2} dot={{ r: 4, fill: 'var(--color-chart-4)' }} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                No data yet
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Cash & Valuation</CardTitle>
          </CardHeader>
          <CardContent>
            {cashHistory.length > 1 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={cashHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="label" fontSize={12} tick={{ fill: 'var(--color-muted-foreground)' }} />
                  <YAxis fontSize={12} tick={{ fill: 'var(--color-muted-foreground)' }} />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v))}
                    contentStyle={CHART_TOOLTIP_STYLE}
                  />
                  <Line type="monotone" dataKey="cash" name="Cash" stroke="var(--color-chart-2)" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="valuation" name="Valuation" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                Not enough data yet
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts row 2: Share price */}
      <Card>
        <CardHeader>
          <CardTitle>Share Price History</CardTitle>
        </CardHeader>
        <CardContent>
          {priceHistory.length > 1 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={priceHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="date" fontSize={12} tick={{ fill: 'var(--color-muted-foreground)' }} />
                <YAxis fontSize={12} tick={{ fill: 'var(--color-muted-foreground)' }} />
                <Tooltip
                  formatter={(v) => formatCurrency(Number(v))}
                  contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-foreground)' }}
                />
                <Line type="monotone" dataKey="price" name="Price" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
              Not enough data yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length > 0 ? (
            <div className="space-y-2">
              {recent.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <div className="text-sm font-medium">{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.date}</div>
                  </div>
                  <div className={`text-sm font-semibold ${t.type === 'revenue' ? 'text-positive' : 'text-negative'}`}>
                    {t.type === 'revenue' ? '+' : '-'}{formatCurrency(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">No transactions this period</div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
