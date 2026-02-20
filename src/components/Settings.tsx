import { useRef, useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { getSetting, setSetting } from '@/db/queries'
import { exportDatabase, importDatabase, resetDatabase, persistDatabase } from '@/db/database'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Download, Upload, RotateCcw } from 'lucide-react'

export function Settings({ onDbChange }: { onDbChange: () => void }) {
  const { db, refresh } = useDatabase()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [taxRate, setTaxRate] = useState(getSetting(db, 'tax_rate') ?? '25')

  const saveName = getSetting(db, 'save_name')

  function handleExport() {
    const data = exportDatabase()
    const blob = new Blob([data.buffer as ArrayBuffer], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const prefix = saveName ? saveName.replace(/[^a-zA-Z0-9_-]/g, '_') : 'fs25accounting'
    a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.db`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const buffer = await file.arrayBuffer()
    await importDatabase(new Uint8Array(buffer))
    onDbChange()
  }

  async function handleReset() {
    if (!confirm('Reset everything? All data will be lost.')) return
    await resetDatabase()
    onDbChange()
  }

  async function saveTaxRate() {
    setSetting(db, 'tax_rate', taxRate)
    await persistDatabase()
    refresh()
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Tax rate */}
      <Card>
        <CardHeader>
          <CardTitle>Tax Rate</CardTitle>
          <CardDescription>Applied to distributable profit at year-end</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Label>Rate (%)</Label>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="w-24"
            />
            <Button size="sm" onClick={saveTaxRate}>Save</Button>
          </div>
        </CardContent>
      </Card>

      {/* Data management */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" /> Export
            </CardTitle>
            <CardDescription>Download the database</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport} className="w-full">
              Export .db
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" /> Import
            </CardTitle>
            <CardDescription>Load an existing database</CardDescription>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept=".db"
              onChange={handleImport}
              className="hidden"
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full">
              Import .db
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="h-5 w-5" /> Reset
            </CardTitle>
            <CardDescription>Start from scratch</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleReset} className="w-full">
              Reset
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
