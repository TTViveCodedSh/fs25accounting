import { useState, useRef } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { getAssets, createAsset, sellAsset, getCurrentPeriod, createTransaction, getCategories } from '@/db/queries'
import { getDepreciation, getNetBookValue } from '@/lib/calculations'
import { getAssetTypeConfig } from '@/lib/assetConfig'
import { persistDatabase } from '@/db/database'
import { formatCurrency, todayISO } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Dialog, DialogHeader, DialogTitle } from './ui/dialog'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'

const assetTypes = ['vehicle', 'implement', 'building', 'land'] as const

export function Assets() {
  const { db, refresh } = useDatabase()
  const assetTypeConfig = getAssetTypeConfig(db)
  const [selectedAssetType, setSelectedAssetType] = useState<'vehicle' | 'implement' | 'building' | 'land' | null>(null)
  const [sellingAssetId, setSellingAssetId] = useState<number | null>(null)
  const [scheduleAssetId, setScheduleAssetId] = useState<number | null>(null)

  const [price, setPrice] = useState('')
  const [notes, setNotes] = useState('')
  const [sellPrice, setSellPrice] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmSell, setConfirmSell] = useState(false)

  const priceRef = useRef<HTMLInputElement>(null)
  const sellPriceRef = useRef<HTMLInputElement>(null)

  const assets = getAssets(db)
  const currentPeriod = getCurrentPeriod(db)

  const activeAssets = assets.filter((a) => !a.sold_date)
  const soldAssets = assets.filter((a) => a.sold_date)

  function selectAssetType(type: typeof assetTypes[number]) {
    setSelectedAssetType(type)
    setSellingAssetId(null)
    setPrice('')
    setNotes('')
    setFormError(null)
    setTimeout(() => priceRef.current?.focus(), 0)
  }

  async function handleBuy(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPeriod) { setFormError('No open period — open one first'); return }
    if (!selectedAssetType) return
    const p = parseFloat(price)
    if (isNaN(p) || p <= 0) { setFormError('Amount must be greater than zero'); return }

    const config = assetTypeConfig[selectedAssetType]
    const assetName = notes.trim() || config.label
    createAsset(db, assetName, selectedAssetType, p, todayISO(), config.depYears, null)

    await persistDatabase()
    refresh()
    setFormError(null)
    setPrice('')
    setNotes('')
    setSelectedAssetType(null)
  }

  function openSellForm(assetId: number) {
    setSelectedAssetType(null)
    setSellingAssetId(assetId)
    setSellPrice('')
    setFormError(null)
    setTimeout(() => sellPriceRef.current?.focus(), 0)
  }

  function validateSell(): boolean {
    if (!currentPeriod) { setFormError('No open period — open one first'); return false }
    if (!sellingAssetId) return false
    const sp = parseFloat(sellPrice)
    if (isNaN(sp) || sp < 0) { setFormError('Amount must be greater than zero'); return false }
    return true
  }

  async function executeSell() {
    if (!currentPeriod || !sellingAssetId) return
    const sp = parseFloat(sellPrice)
    if (isNaN(sp) || sp < 0) return

    const asset = assets.find((a) => a.id === sellingAssetId)
    if (!asset) return

    const nbv = getNetBookValue(asset)
    const date = todayISO()
    sellAsset(db, sellingAssetId, date, sp)

    const diff = sp - nbv
    if (diff > 0) {
      const cats = getCategories(db, 'revenue')
      const cat = cats.find((c) => c.name === 'Capital Gain')
      createTransaction(db, currentPeriod.id, date, `Capital gain: ${asset.name}`, diff, 'revenue', cat?.id ?? null, null)
    } else if (diff < 0) {
      const cats = getCategories(db, 'expense')
      const cat = cats.find((c) => c.name === 'Capital Loss')
      createTransaction(db, currentPeriod.id, date, `Capital loss: ${asset.name}`, Math.abs(diff), 'expense', cat?.id ?? null, null)
    }

    await persistDatabase()
    refresh()
    setFormError(null)
    setSellingAssetId(null)
    setSellPrice('')
  }

  function getDepreciationSchedule(asset: typeof assets[0]) {
    if (!asset.depreciation_years) return []
    const schedule = []
    for (let y = 1; y <= asset.depreciation_years; y++) {
      const annual = asset.purchase_price / asset.depreciation_years
      const accumulated = annual * y
      const nbv = asset.purchase_price - accumulated
      schedule.push({ year: y, annual, accumulated, nbv: Math.max(nbv, 0) })
    }
    return schedule
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Assets</h1>

      {currentPeriod && (
        <Card>
          <CardContent className="space-y-3 pt-4">
            <div className="flex flex-wrap gap-1">
              {assetTypes.map((type) => {
                const config = assetTypeConfig[type]
                const Icon = config.icon
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => selectAssetType(type)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
                      selectedAssetType === type
                        ? 'bg-primary/15 border-primary dark:bg-primary/20 dark:border-primary'
                        : 'border-primary/30 hover:bg-primary/5 dark:border-primary/30 dark:hover:bg-primary/10'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {config.label}
                  </button>
                )
              })}
            </div>
            {selectedAssetType && (
              <form onSubmit={handleBuy} className="flex items-end gap-2 pt-2 border-t">
                <div className="text-sm font-medium flex items-center gap-1 min-w-0 shrink-0">
                  {(() => { const Icon = assetTypeConfig[selectedAssetType].icon; return <Icon className="h-4 w-4" /> })()}
                  <span className="truncate">{assetTypeConfig[selectedAssetType].label}</span>
                </div>
                <Input
                  ref={priceRef}
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Price"
                  value={price}
                  onChange={(e) => { setPrice(e.target.value); setFormError(null) }}
                  className="h-8 w-28 text-sm"
                  required
                />
                <Input
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-8 flex-1 text-sm"
                />
                <Button type="submit" size="sm" className="h-8 shrink-0">Buy</Button>
                <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0" onClick={() => { setSelectedAssetType(null); setFormError(null) }}>Cancel</Button>
              </form>
            )}
            {formError && !sellingAssetId && <p className="text-xs text-negative mt-1">{formError}</p>}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {activeAssets.length === 0 && (
          <div className="col-span-full text-muted-foreground text-sm p-4">No assets</div>
        )}
        {activeAssets.map((asset) => {
          const config = assetTypeConfig[asset.asset_type]
          const Icon = config.icon
          const dep = getDepreciation(asset)
          const nbv = getNetBookValue(asset)
          const depPercent = asset.depreciation_years ? (dep / asset.purchase_price) * 100 : 0
          const isSelling = sellingAssetId === asset.id

          return (
            <Card key={asset.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-base">{asset.name}</CardTitle>
                  </div>
                  <Badge variant="outline">{config.label}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Purchase price</span>
                  <span className="font-medium">{formatCurrency(asset.purchase_price)}</span>
                </div>
                {asset.depreciation_years && (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Depreciation</span>
                      <span className="text-negative">-{formatCurrency(dep)}</span>
                    </div>
                    <Progress value={depPercent} />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Net book value</span>
                      <span className="font-bold">{formatCurrency(nbv)}</span>
                    </div>
                  </>
                )}
                {!asset.depreciation_years && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Net book value</span>
                    <span className="font-bold">{formatCurrency(nbv)}</span>
                  </div>
                )}

                {isSelling ? (
                  <div className="space-y-2 pt-2 border-t">
                    <div className="text-xs text-muted-foreground">NBV: {formatCurrency(nbv)}</div>
                    <form onSubmit={(e) => { e.preventDefault(); if (validateSell()) setConfirmSell(true) }} className="flex items-end gap-2">
                      <Input
                        ref={sellPriceRef}
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Sale price"
                        value={sellPrice}
                        onChange={(e) => { setSellPrice(e.target.value); setFormError(null) }}
                        className="h-8 flex-1 text-sm"
                        required
                      />
                      <Button type="submit" variant="destructive" size="sm" className="h-8 shrink-0">Confirm Sale</Button>
                      <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0" onClick={() => { setSellingAssetId(null); setFormError(null) }}>Cancel</Button>
                    </form>
                    {formError && <p className="text-xs text-negative">{formError}</p>}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => openSellForm(asset.id)}>Sell</Button>
                    {asset.depreciation_years && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setScheduleAssetId(scheduleAssetId === asset.id ? null : asset.id)}
                      >
                        Dep. schedule
                      </Button>
                    )}
                  </div>
                )}

                {scheduleAssetId === asset.id && asset.depreciation_years && (
                  <div className="mt-2 text-xs">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b">
                          <th className="pb-1 text-left">Year</th>
                          <th className="pb-1 text-right">Annual</th>
                          <th className="pb-1 text-right">Accumulated</th>
                          <th className="pb-1 text-right">NBV</th>
                        </tr>
                      </thead>
                      <tbody>
                        {getDepreciationSchedule(asset).map((row) => (
                          <tr key={row.year} className="border-b">
                            <td className="py-1">{row.year}</td>
                            <td className="py-1 text-right">{formatCurrency(row.annual)}</td>
                            <td className="py-1 text-right">{formatCurrency(row.accumulated)}</td>
                            <td className="py-1 text-right">{formatCurrency(row.nbv)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {asset.from_lease_id && (
                  <div className="text-xs text-muted-foreground">From lease</div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {soldAssets.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Sold Assets</h2>
          <Card>
            <CardContent noPadding>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-right">Purchase price</th>
                    <th className="p-3 text-right">Sale price</th>
                    <th className="p-3 text-right">Gain/Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {soldAssets.map((a) => {
                    const depAtSale = getDepreciation(a)
                    const nbvAtSale = a.purchase_price - depAtSale
                    const gainLoss = (a.sold_price ?? 0) - nbvAtSale
                    return (
                      <tr key={a.id} className="border-b">
                        <td className="p-3">{a.name}</td>
                        <td className="p-3">{assetTypeConfig[a.asset_type].label}</td>
                        <td className="p-3 text-right">{formatCurrency(a.purchase_price)}</td>
                        <td className="p-3 text-right">{formatCurrency(a.sold_price ?? 0)}</td>
                        <td className={`p-3 text-right font-semibold ${gainLoss >= 0 ? 'text-positive' : 'text-negative'}`}>
                          {gainLoss >= 0 ? '+' : ''}{formatCurrency(gainLoss)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={confirmSell} onOpenChange={setConfirmSell}>
        <DialogHeader>
          <DialogTitle>Confirm Sale</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          Are you sure you want to sell{' '}
          {sellingAssetId && assets.find((a) => a.id === sellingAssetId)?.name}{' '}
          for {formatCurrency(parseFloat(sellPrice) || 0)}? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmSell(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { setConfirmSell(false); executeSell() }}>Confirm Sale</Button>
        </div>
      </Dialog>
    </div>
  )
}
