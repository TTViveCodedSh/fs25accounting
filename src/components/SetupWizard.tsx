import { useState } from 'react'
import type { Database } from 'sql.js'
import { initializeFarm } from '@/db/queries'
import { persistDatabase } from '@/db/database'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select } from './ui/select'
import { Tractor } from 'lucide-react'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

interface SetupWizardProps {
  db: Database
  onComplete: () => void
}

export function SetupWizard({ db, onComplete }: SetupWizardProps) {
  const [saveName, setSaveName] = useState('')
  const [initialCapital, setInitialCapital] = useState('500000')
  const [totalShares, setTotalShares] = useState('5000')
  const [investorShares, setInvestorShares] = useState('2500')
  const [taxRate, setTaxRate] = useState('25')
  const [depYearsVehicle, setDepYearsVehicle] = useState('5')
  const [depYearsImplement, setDepYearsImplement] = useState('5')
  const [depYearsBuilding, setDepYearsBuilding] = useState('10')
  const [startMonth, setStartMonth] = useState('8')
  const [buybackMultiplier, setBuybackMultiplier] = useState('4')

  const totalSharesNum = parseInt(totalShares) || 0
  const investorSharesNum = parseInt(investorShares) || 0
  const farmShares = Math.max(0, totalSharesNum - investorSharesNum)
  const capitalNum = parseFloat(initialCapital) || 0
  const sharePrice = totalSharesNum > 0 ? capitalNum / totalSharesNum : 0
  const buybackPrice = sharePrice * (parseFloat(buybackMultiplier) || 4)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    initializeFarm(db, {
      saveName: saveName.trim(),
      initialCapital: capitalNum,
      totalShares: totalSharesNum,
      investorShares: investorSharesNum,
      taxRate: parseFloat(taxRate) || 25,
      depYearsVehicle: parseInt(depYearsVehicle) || 5,
      depYearsImplement: parseInt(depYearsImplement) || 5,
      depYearsBuilding: parseInt(depYearsBuilding) || 10,
      startMonth: parseInt(startMonth) || 8,
      buybackMultiplier: parseFloat(buybackMultiplier) || 4,
    })

    await persistDatabase()
    onComplete()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <Tractor className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-2xl">FS25 Accounting</CardTitle>
          <CardDescription>Configure your farm to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Save name */}
            <div className="space-y-2">
              <Label>Farm / Save Name</Label>
              <Input
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="e.g. Elm Creek Farm"
                required
              />
            </div>

            {/* Start month */}
            <div className="space-y-2">
              <Label>Starting Month</Label>
              <Select value={startMonth} onChange={(e) => setStartMonth(e.target.value)}>
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </Select>
            </div>

            {/* Starting capital */}
            <div className="space-y-2">
              <Label>Starting Capital</Label>
              <Input
                type="number"
                step="1"
                min="0"
                value={initialCapital}
                onChange={(e) => setInitialCapital(e.target.value)}
                required
              />
            </div>

            {/* Ownership */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Ownership</legend>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Total Shares</Label>
                  <Input
                    type="number"
                    min="1"
                    value={totalShares}
                    onChange={(e) => setTotalShares(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Investor Shares</Label>
                  <Input
                    type="number"
                    min="0"
                    value={investorShares}
                    onChange={(e) => setInvestorShares(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Farm shares: {farmShares.toLocaleString()} &middot; Share price: {sharePrice.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })}
              </div>
              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label>Buyback Multiplier</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="1"
                    value={buybackMultiplier}
                    onChange={(e) => setBuybackMultiplier(e.target.value)}
                    required
                  />
                </div>
                <div className="flex items-end pb-2">
                  <span className="text-sm text-muted-foreground">
                    Buyback price: {buybackPrice.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 })}/share
                  </span>
                </div>
              </div>
            </fieldset>

            {/* Tax rate */}
            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                className="w-32"
                required
              />
            </div>

            {/* Depreciation */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Depreciation (years)</legend>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Vehicles</Label>
                  <Input
                    type="number"
                    min="1"
                    value={depYearsVehicle}
                    onChange={(e) => setDepYearsVehicle(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Implements</Label>
                  <Input
                    type="number"
                    min="1"
                    value={depYearsImplement}
                    onChange={(e) => setDepYearsImplement(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Buildings</Label>
                  <Input
                    type="number"
                    min="1"
                    value={depYearsBuilding}
                    onChange={(e) => setDepYearsBuilding(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                Land is never depreciated.
              </div>
            </fieldset>

            <Button type="submit" className="w-full">
              Start Playing
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
