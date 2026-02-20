import { useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { getAssets, createAsset, sellAsset, getCurrentPeriod, createTransaction, getCategories, getSetting } from '@/db/queries'
import { getDepreciation, getNetBookValue } from '@/lib/calculations'
import { persistDatabase } from '@/db/database'
import { formatCurrency, todayISO } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select } from './ui/select'
import { Dialog, DialogHeader, DialogTitle } from './ui/dialog'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Plus, Truck, Wrench, Building, MapPin } from 'lucide-react'

function getAssetTypeConfig(db: import('sql.js').Database) {
  const depVehicle = parseInt(getSetting(db, 'dep_years_vehicle') ?? '5')
  const depImplement = parseInt(getSetting(db, 'dep_years_implement') ?? '5')
  const depBuilding = parseInt(getSetting(db, 'dep_years_building') ?? '10')
  return {
    vehicle: { label: 'Tractor / Vehicle', icon: Truck, depYears: depVehicle as number | null },
    implement: { label: 'Implement / Tool', icon: Wrench, depYears: depImplement as number | null },
    building: { label: 'Building', icon: Building, depYears: depBuilding as number | null },
    land: { label: 'Land', icon: MapPin, depYears: null as number | null },
  }
}

export function Assets() {
  const { db, refresh } = useDatabase()
  const assetTypeConfig = getAssetTypeConfig(db)
  const [buyDialogOpen, setBuyDialogOpen] = useState(false)
  const [sellDialogOpen, setSellDialogOpen] = useState(false)
  const [sellAssetId, setSellAssetId] = useState<number | null>(null)
  const [scheduleAssetId, setScheduleAssetId] = useState<number | null>(null)

  const [name, setName] = useState('')
  const [assetType, setAssetType] = useState<'vehicle' | 'implement' | 'building' | 'land'>('vehicle')
  const [price, setPrice] = useState('')
  const [purchaseDate, setPurchaseDate] = useState(todayISO())

  const [sellPrice, setSellPrice] = useState('')
  const [sellDate, setSellDate] = useState(todayISO())

  const assets = getAssets(db)
  const currentPeriod = getCurrentPeriod(db)

  const activeAssets = assets.filter((a) => !a.sold_date)
  const soldAssets = assets.filter((a) => a.sold_date)

  async function handleBuy(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPeriod) return
    const p = parseFloat(price)
    if (!name || isNaN(p) || p <= 0) return

    const config = assetTypeConfig[assetType]
    createAsset(db, name, assetType, p, purchaseDate, config.depYears, null)

    await persistDatabase()
    refresh()
    setBuyDialogOpen(false)
    setName('')
    setPrice('')
    setAssetType('vehicle')
    setPurchaseDate(todayISO())
  }

  async function handleSell(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPeriod || !sellAssetId) return
    const sp = parseFloat(sellPrice)
    if (isNaN(sp) || sp < 0) return

    const asset = assets.find((a) => a.id === sellAssetId)
    if (!asset) return

    const nbv = getNetBookValue(asset)
    sellAsset(db, sellAssetId, sellDate, sp)

    // Record gain/loss: sale price vs net book value
    const diff = sp - nbv
    if (diff > 0) {
      const cats = getCategories(db, 'revenue')
      const cat = cats.find((c) => c.name === 'Capital Gain')
      createTransaction(db, currentPeriod.id, sellDate, `Capital gain: ${asset.name}`, diff, 'revenue', cat?.id ?? null, null)
    } else if (diff < 0) {
      const cats = getCategories(db, 'expense')
      const cat = cats.find((c) => c.name === 'Capital Loss')
      createTransaction(db, currentPeriod.id, sellDate, `Capital loss: ${asset.name}`, Math.abs(diff), 'expense', cat?.id ?? null, null)
    }

    await persistDatabase()
    refresh()
    setSellDialogOpen(false)
    setSellAssetId(null)
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Assets</h1>
        <Button onClick={() => setBuyDialogOpen(true)} disabled={!currentPeriod}>
          <Plus className="h-4 w-4" /> Buy Asset
        </Button>
      </div>

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
                      <span className="text-red-500">-{formatCurrency(dep)}</span>
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
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSellAssetId(asset.id)
                      setSellPrice('')
                      setSellDate(todayISO())
                      setSellDialogOpen(true)
                    }}
                  >
                    Sell
                  </Button>
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
            <CardContent className="p-0">
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
                        <td className={`p-3 text-right font-semibold ${gainLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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

      <Dialog open={buyDialogOpen} onOpenChange={setBuyDialogOpen}>
        <DialogHeader>
          <DialogTitle>Buy Asset</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleBuy} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Deere 8R" required />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={assetType} onChange={(e) => setAssetType(e.target.value as 'vehicle' | 'implement' | 'building' | 'land')}>
                <option value="vehicle">Tractor / Vehicle ({assetTypeConfig.vehicle.depYears}yr)</option>
                <option value="implement">Implement / Tool ({assetTypeConfig.implement.depYears}yr)</option>
                <option value="building">Building ({assetTypeConfig.building.depYears}yr)</option>
                <option value="land">Land (no dep.)</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Purchase date</Label>
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Purchase price</Label>
            <Input type="number" step="0.01" min="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setBuyDialogOpen(false)}>Cancel</Button>
            <Button type="submit">Buy</Button>
          </div>
        </form>
      </Dialog>

      <Dialog open={sellDialogOpen} onOpenChange={setSellDialogOpen}>
        <DialogHeader>
          <DialogTitle>Sell Asset</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSell} className="space-y-4">
          {sellAssetId && (() => {
            const asset = assets.find((a) => a.id === sellAssetId)
            if (!asset) return null
            const nbv = getNetBookValue(asset)
            return (
              <div className="text-sm space-y-1">
                <div><strong>{asset.name}</strong></div>
                <div>Net book value: {formatCurrency(nbv)}</div>
              </div>
            )
          })()}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Sale price</Label>
              <Input type="number" step="0.01" min="0" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Sale date</Label>
              <Input type="date" value={sellDate} onChange={(e) => setSellDate(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setSellDialogOpen(false)}>Cancel</Button>
            <Button type="submit">Sell</Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
