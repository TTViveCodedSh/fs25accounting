import { useDatabase } from '@/hooks/useDatabase'
import { getSharePrice, getValuation, getBuybackMinPrice, getBuybackEffectivePrice } from '@/lib/calculations'
import { getSetting, getDividends, getValuationSnapshots } from '@/db/queries'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'
import { Tooltip as InfoTooltip } from './ui/tooltip'
import { Info } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts'

export function Shares() {
  const { db } = useDatabase()

  const sharePrice = getSharePrice(db)
  const valuation = getValuation(db)
  const totalShares = Number(getSetting(db, 'total_shares') ?? '5000')
  const investorShares = Number(getSetting(db, 'investor_shares') ?? '2500')
  const initialPrice = Number(getSetting(db, 'initial_share_price') ?? '100')
  const buybackMin = getBuybackMinPrice(db)
  const buybackEffective = getBuybackEffectivePrice(db)
  const totalBuybackCost = buybackEffective * investorShares
  const isAboveMin = sharePrice > buybackMin

  const investorValue = investorShares * sharePrice
  const investorInitial = investorShares * initialPrice
  const investorReturn = ((investorValue - investorInitial) / investorInitial) * 100

  const dividends = getDividends(db)
  const totalDividendsPaid = dividends.reduce((s, d) => s + d.total_amount, 0)

  const snapshots = getValuationSnapshots(db)
  const priceHistory = snapshots.map((s) => ({
    date: s.date,
    price: Math.round(s.share_price),
  }))

  // Valuation breakdown
  const latestSnapshot = snapshots[snapshots.length - 1]
  const breakdownData = latestSnapshot
    ? [
        { name: 'Cash', value: latestSnapshot.cash },
        { name: 'Assets (NBV)', value: latestSnapshot.total_asset_nbv },
        { name: 'Debt', value: -latestSnapshot.total_debt },
        { name: 'Leases', value: -latestSnapshot.total_lease_obligations },
      ]
    : []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Shares & Investors</h1>

      {/* Hero share price */}
      <Card>
        <CardContent className="p-6 flex items-center justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Share Price</div>
            <div className="text-4xl font-bold">{formatCurrency(sharePrice)}</div>
            <div className="text-sm text-muted-foreground mt-1">
              {totalShares.toLocaleString('en-US')} shares outstanding
            </div>
          </div>
          <div className="w-48 h-20">
            {priceHistory.length > 1 && (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={priceHistory}>
                  <Line type="monotone" dataKey="price" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Valuation */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Valuation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(valuation)}</div>
          </CardContent>
        </Card>

        {/* Investor return */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Investor Return</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(investorValue)}</div>
            <div className="text-sm text-muted-foreground">
              Initial: {formatCurrency(investorInitial)}
            </div>
            <div className={`text-sm font-semibold ${investorReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {investorReturn >= 0 ? '+' : ''}{investorReturn.toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        {/* Buyback */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-1.5">
              <CardTitle className="text-sm font-medium text-muted-foreground">Share Buyback</CardTitle>
              <InfoTooltip content={
                <div className="space-y-1">
                  <p>Buyback price is the higher of the minimum price ({formatCurrency(buybackMin)}/share) and the current share value ({formatCurrency(sharePrice)}/share).</p>
                  <p>The minimum is set at setup as initial share price x multiplier.</p>
                </div>
              }>
                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </InfoTooltip>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-2xl font-bold">{formatCurrency(buybackEffective)}<span className="text-sm font-normal text-muted-foreground">/share</span></div>
            <div className="text-sm text-muted-foreground">
              Total: {formatCurrency(totalBuybackCost)} for {investorShares.toLocaleString()} shares
            </div>
            {isAboveMin ? (
              <Badge variant="default">
                Paying share value (above {formatCurrency(buybackMin)} min)
              </Badge>
            ) : (
              <Badge variant="warning">
                Paying minimum (share worth {formatCurrency(sharePrice)})
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Valuation breakdown chart */}
      {breakdownData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Valuation Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={breakdownData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis type="number" tickFormatter={(v: number) => formatCurrency(v)} fontSize={12} tick={{ fill: 'var(--color-muted-foreground)' }} />
                <YAxis type="category" dataKey="name" width={100} fontSize={12} tick={{ fill: 'var(--color-muted-foreground)' }} />
                <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ backgroundColor: 'var(--color-card)', border: '1px solid var(--color-border)', borderRadius: '8px', color: 'var(--color-foreground)' }} />
                <Bar dataKey="value" name="Amount">
                  {breakdownData.map((entry, i) => (
                    <Cell key={i} fill={entry.value >= 0 ? 'var(--color-chart-2)' : 'var(--color-destructive)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Dividends */}
      <Card>
        <CardHeader>
          <CardTitle>Dividends</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 text-sm">
            Total paid: <span className="font-semibold">{formatCurrency(totalDividendsPaid)}</span>
          </div>
          {dividends.length === 0 ? (
            <div className="text-sm text-muted-foreground">No dividends paid yet. Dividends are allocated during year-end closing.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 text-left">Date</th>
                  <th className="pb-2 text-right">Total</th>
                  <th className="pb-2 text-right">Per Share</th>
                </tr>
              </thead>
              <tbody>
                {dividends.map((d) => (
                  <tr key={d.id} className="border-b">
                    <td className="py-2">{d.date}</td>
                    <td className="py-2 text-right">{formatCurrency(d.total_amount)}</td>
                    <td className="py-2 text-right">{formatCurrency(d.per_share)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
