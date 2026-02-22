import { useState, useRef } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import {
  getLeases,
  createLease,
  purchaseLease,
  returnLease,
  createAsset,
  sellAsset,
  getCurrentPeriod,
  createTransaction,
  getAssetByLeaseId,
  getCategories,
} from '@/db/queries'
import { getNetBookValue } from '@/lib/calculations'
import { getAssetTypeConfig } from '@/lib/assetConfig'
import { persistDatabase } from '@/db/database'
import { formatCurrency, formatPercent, todayISO } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Dialog, DialogHeader, DialogTitle } from './ui/dialog'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Package, RotateCcw } from 'lucide-react'

const assetTypes = ['vehicle', 'implement', 'building', 'land'] as const

/** Compute the monthly payment using standard amortizing (annuity) formula. */
function computeMonthly(price: number, downPayment: number, finalPayment: number, rate: number, durationYears: number): number {
  const financed = price - downPayment
  const months = durationYears * 12
  if (months <= 0) return 0
  const monthlyRate = rate / 100 / 12
  if (monthlyRate === 0) return (financed - finalPayment) / months
  const pvResidual = finalPayment / Math.pow(1 + monthlyRate, months)
  return (financed - pvResidual) * monthlyRate / (1 - Math.pow(1 + monthlyRate, -months))
}

/** Monthly interest portion based on remaining balance (declining). */
function monthlyInterest(remainingBalance: number, rate: number): number {
  return remainingBalance * (rate / 100) / 12
}

export function Leases() {
  const { db, refresh } = useDatabase()
  const assetTypeConfig = getAssetTypeConfig(db)
  const [selectedLeaseType, setSelectedLeaseType] = useState<'vehicle' | 'implement' | 'building' | 'land' | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ action: () => void; description: string } | null>(null)

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [durationYears, setDurationYears] = useState('3')
  const [interestRate, setInterestRate] = useState('5')
  const [downPayment, setDownPayment] = useState('')
  const [finalPayment, setFinalPayment] = useState('')

  const nameRef = useRef<HTMLInputElement>(null)

  const leases = getLeases(db)
  const currentPeriod = getCurrentPeriod(db)
  const activeLeases = leases.filter((l) => l.status === 'active')
  const endedLeases = leases.filter((l) => l.status !== 'active')

  // Computed monthly for the form
  const pNum = parseFloat(price) || 0
  const dpNum = parseFloat(downPayment) || 0
  const fpNum = parseFloat(finalPayment) || 0
  const rateNum = parseFloat(interestRate) || 0
  const durNum = parseFloat(durationYears) || 0
  const computedMonthly = pNum > 0 && durNum > 0 ? computeMonthly(pNum, dpNum, fpNum, rateNum, durNum) : 0

  function selectLeaseType(type: typeof assetTypes[number]) {
    setSelectedLeaseType(type)
    resetForm()
    setFormError(null)
    setTimeout(() => nameRef.current?.focus(), 0)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPeriod) { setFormError('No open period — open one first'); return }
    if (!selectedLeaseType) return
    if (!name) { setFormError('Please fill in all required fields'); return }
    if (pNum <= 0) { setFormError('Amount must be greater than zero'); return }
    if (durNum <= 0) { setFormError('Please fill in all required fields'); return }

    const durationMonths = Math.round(durNum * 12)
    const monthly = Math.round(computedMonthly * 100) / 100
    const date = todayISO()

    // Create the lease
    const leaseId = createLease(db, name, pNum, dpNum, monthly, durationMonths, fpNum, date, rateNum)

    // Create the asset immediately at full price with normal depreciation
    const config = assetTypeConfig[selectedLeaseType]
    createAsset(db, name, selectedLeaseType, pNum, date, config.depYears, leaseId)

    await persistDatabase()
    refresh()
    setFormError(null)
    setSelectedLeaseType(null)
    resetForm()
  }

  async function handlePurchase(leaseId: number) {
    if (!currentPeriod) return
    const lease = leases.find((l) => l.id === leaseId)
    if (!lease) return

    // Pay the final payment (residual value) — this zeroes the remaining_balance
    purchaseLease(db, leaseId)

    await persistDatabase()
    refresh()
  }

  async function handleReturn(leaseId: number) {
    if (!currentPeriod) return
    const lease = leases.find((l) => l.id === leaseId)
    if (!lease) return

    returnLease(db, leaseId)

    // Dispose of the asset (sell at $0)
    const asset = getAssetByLeaseId(db, leaseId)
    if (asset && !asset.sold_date) {
      const nbv = getNetBookValue(asset)
      sellAsset(db, asset.id, todayISO(), 0)

      // Record capital loss if NBV > 0
      if (nbv > 0) {
        const cats = getCategories(db, 'expense')
        const cat = cats.find((c) => c.name === 'Capital Loss')
        createTransaction(db, currentPeriod.id, todayISO(), `Lease return loss: ${lease.name}`, nbv, 'expense', cat?.id ?? null, null)
      }
    }

    await persistDatabase()
    refresh()
  }

  function resetForm() {
    setName('')
    setPrice('')
    setDurationYears('3')
    setInterestRate('5')
    setDownPayment('')
    setFinalPayment('')
  }

  function getLeaseInterest(lease: typeof leases[0]): number {
    return Math.round(monthlyInterest(lease.remaining_balance, lease.interest_rate))
  }

  function getLeaseCapital(lease: typeof leases[0]): number {
    return Math.round((lease.monthly_payment - getLeaseInterest(lease)) * 100) / 100
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Leases</h1>

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
                    onClick={() => selectLeaseType(type)}
                    className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
                      selectedLeaseType === type
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
            {selectedLeaseType && (
              <form onSubmit={handleCreate} className="space-y-4 pt-2 border-t">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Equipment Name</Label>
                    <Input ref={nameRef} value={name} onChange={(e) => setName(e.target.value)} placeholder="E.g.: Combine CR 10.90" required />
                  </div>
                  <div className="space-y-2">
                    <Label>Equipment Price</Label>
                    <Input type="number" step="0.01" min="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duration (years)</Label>
                    <Input type="number" min="1" step="1" value={durationYears} onChange={(e) => setDurationYears(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Interest Rate (%)</Label>
                    <Input type="number" step="0.01" min="0" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Down Payment</Label>
                    <Input type="number" step="0.01" min="0" value={downPayment} onChange={(e) => setDownPayment(e.target.value)} placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <Label>Final Payment</Label>
                    <Input type="number" step="0.01" min="0" value={finalPayment} onChange={(e) => setFinalPayment(e.target.value)} placeholder="0" />
                  </div>
                </div>
                {computedMonthly > 0 && (
                  <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Monthly Payment</span>
                      <span className="font-bold">{formatCurrency(Math.round(computedMonthly * 100) / 100)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Capital: {formatCurrency(Math.round((computedMonthly - monthlyInterest(pNum - dpNum, rateNum)) * 100) / 100)}</span>
                      <span>Interest (1st month): {formatCurrency(Math.round(monthlyInterest(pNum - dpNum, rateNum)))}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Total cost over lease</span>
                      <span>{formatCurrency(dpNum + Math.round(computedMonthly * 100) / 100 * durNum * 12 + fpNum)}</span>
                    </div>
                  </div>
                )}
                {formError && <p className="text-xs text-negative">{formError}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedLeaseType(null); setFormError(null) }}>Cancel</Button>
                  <Button type="submit" size="sm">Create Lease</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {activeLeases.length === 0 && (
        <div className="text-muted-foreground text-sm">No active leases</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {activeLeases.map((lease) => {
          const progressPct = (lease.payments_made / lease.duration_months) * 100
          const isComplete = lease.payments_made >= lease.duration_months
          const interest = getLeaseInterest(lease)
          const capital = getLeaseCapital(lease)

          return (
            <Card key={lease.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{lease.name}</CardTitle>
                  <Badge variant={isComplete ? 'success' : 'secondary'}>
                    {isComplete ? 'Payments Done' : `${lease.payments_made}/${lease.duration_months} months`}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Equipment Value</span>
                  <span className="font-medium">{formatCurrency(lease.total_value)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Remaining Debt</span>
                  <span className="font-bold text-negative">{formatCurrency(lease.remaining_balance)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Monthly Payment</span>
                  <span className="font-medium">{formatCurrency(lease.monthly_payment)}</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Split: {formatCurrency(capital)} capital + {formatCurrency(interest)} interest</span>
                  <span>{formatPercent(lease.interest_rate)}</span>
                </div>
                {lease.residual_value > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Final Payment</span>
                    <span className="font-medium">{formatCurrency(lease.residual_value)}</span>
                  </div>
                )}
                <Progress value={progressPct} />
                {isComplete && (
                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" onClick={() => setConfirmAction({ action: () => handlePurchase(lease.id), description: `Buy out "${lease.name}" for ${formatCurrency(lease.residual_value)}?` })} disabled={!currentPeriod}>
                      <Package className="h-4 w-4" /> Buy Out ({formatCurrency(lease.residual_value)})
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setConfirmAction({ action: () => handleReturn(lease.id), description: `Return "${lease.name}"? The asset will be disposed of.` })}>
                      <RotateCcw className="h-4 w-4" /> Return
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {endedLeases.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Ended Leases</h2>
          <Card>
            <CardContent noPadding>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-3 text-left">Name</th>
                    <th className="p-3 text-right">Value</th>
                    <th className="p-3 text-right">Rate</th>
                    <th className="p-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {endedLeases.map((l) => (
                    <tr key={l.id} className="border-b">
                      <td className="p-3">{l.name}</td>
                      <td className="p-3 text-right">{formatCurrency(l.total_value)}</td>
                      <td className="p-3 text-right">{formatPercent(l.interest_rate)}</td>
                      <td className="p-3">
                        <Badge variant={l.status === 'purchased' ? 'success' : 'secondary'}>
                          {l.status === 'purchased' ? 'Purchased' : 'Returned'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={!!confirmAction} onOpenChange={(open) => { if (!open) setConfirmAction(null) }}>
        <DialogHeader>
          <DialogTitle>Are you sure?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">{confirmAction?.description}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmAction(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { confirmAction?.action(); setConfirmAction(null) }}>Confirm</Button>
        </div>
      </Dialog>
    </div>
  )
}
