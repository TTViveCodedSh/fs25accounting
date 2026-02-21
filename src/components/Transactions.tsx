import { useState, useMemo, useRef } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { getCategories, getTransactions, createTransaction, deleteTransaction, getCurrentPeriod } from '@/db/queries'
import type { Category } from '@/db/queries'
import { persistDatabase } from '@/db/database'
import { formatCurrency, formatDate, todayISO } from '@/lib/utils'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Dialog, DialogHeader, DialogTitle } from './ui/dialog'
import { Trash2, Search } from 'lucide-react'

// --- Category group definitions ---

const REVENUE_GROUPS = [
  { label: 'Grains', names: ['Wheat', 'Barley', 'Oat', 'Canola', 'Corn', 'Sorghum', 'Soybean', 'Sunflower', 'Rice', 'Long Grain Rice'] },
  { label: 'Root Crops', names: ['Potato', 'Sugar Beet', 'Sugarcane', 'Red Beet', 'Carrots', 'Parsnip'] },
  { label: 'Vegetables & Herbs', names: ['Spinach', 'Peas', 'Green Beans', 'Lettuce', 'Tomatoes', 'Cabbage', 'Chili', 'Garlic', 'Spring Onion'] },
  { label: 'Fruits & Mushrooms', names: ['Grapes', 'Olives', 'Strawberries', 'Mushrooms'] },
  { label: 'Forage & Fiber', names: ['Grass', 'Hay', 'Straw', 'Silage', 'Cotton', 'Poplar'] },
  { label: 'Livestock', names: ['Cattle', 'Pigs', 'Sheep', 'Chickens', 'Horses', 'Goats', 'Water Buffalo'] },
  { label: 'Animal Products', names: ['Milk', 'Eggs', 'Wool', 'Honey'] },
  { label: 'Forestry', names: ['Wood', 'Wood Chips', 'Planks'] },
  { label: 'Dairy', names: ['Butter', 'Cheese', 'Goat Cheese', 'Buffalo Mozzarella', 'Bottled Milk'] },
  { label: 'Oils', names: ['Sunflower Oil', 'Olive Oil', 'Canola Oil'] },
  { label: 'Bakery & Food', names: ['Flour', 'Rice Flour', 'Sugar', 'Bread', 'Cake', 'Cereal', 'Chocolate', 'Potato Chips'] },
  { label: 'Preserved & Packed', names: ['Raisins', 'Grape Juice', 'Soup', 'Kimchi', 'Canned Vegetables'] },
  { label: 'Textiles', names: ['Fabric', 'Clothes', 'Rope'] },
  { label: 'Crafted & Industrial', names: ['Furniture', 'Piano', 'Paper', 'Barrels', 'Wagons', 'Toy Tractors'] },
  { label: 'Construction', names: ['Cement', 'Concrete Tiles', 'Roof Tiles', 'Prefab Walls'] },
  { label: 'Contract Income', names: ['Contracts', 'Missions'] },
  { label: 'Other', names: ['Subsidies', 'Other Revenue'] },
]

const EXPENSE_GROUPS = [
  { label: 'Inputs', names: ['Seeds', 'Fertilizer', 'Lime', 'Herbicide'] },
  { label: 'Operations', names: ['Fuel', 'Worker Wages', 'Maintenance', 'Hand Tools', 'Vehicle Rent'] },
  { label: 'Animals', names: ['Animal Feed'] },
  { label: 'Other', names: ['Other Expenses'] },
]

// Support old category names from pre-migration databases
const LEGACY_NAMES: Record<string, string> = {
  'Grain Sales': 'Wheat',
  'Wood Sales': 'Wood',
  'Animal Sales': 'Cattle',
  'Milk / Eggs': 'Milk',
  'Salaries': 'Worker Wages',
  'Maintenance / Repairs': 'Maintenance',
  'Land Rent': 'Vehicle Rent',
}

function groupCategories(categories: Category[], groups: typeof REVENUE_GROUPS) {
  return groups.map((g) => ({
    ...g,
    categories: g.names
      .map((n) => categories.find((c) => c.name === n) ?? categories.find((c) => LEGACY_NAMES[c.name] === n))
      .filter((c): c is Category => !!c),
  })).filter((g) => g.categories.length > 0)
}

export function Transactions() {
  const { db, refresh } = useDatabase()
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<'revenue' | 'expense'>('revenue')
  const [selectedCat, setSelectedCat] = useState<Category | null>(null)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; label: string } | null>(null)
  const amountRef = useRef<HTMLInputElement>(null)

  const currentPeriod = getCurrentPeriod(db)
  const categories = getCategories(db)
  const transactions = getTransactions(db)

  const revenueCategories = categories.filter((c) => c.type === 'revenue')
  const expenseCategories = categories.filter((c) => c.type === 'expense')

  const revenueGrouped = useMemo(() => groupCategories(revenueCategories, REVENUE_GROUPS), [revenueCategories])
  const expenseGrouped = useMemo(() => groupCategories(expenseCategories, EXPENSE_GROUPS), [expenseCategories])

  const activeGroups = tab === 'revenue' ? revenueGrouped : expenseGrouped
  const searchLower = search.toLowerCase()

  function selectCategory(cat: Category) {
    setSelectedCat(cat)
    setAmount('')
    setNotes('')
    // Focus amount input after render
    setTimeout(() => amountRef.current?.focus(), 0)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!currentPeriod) { setFormError('No open period — open one first'); return }
    if (!selectedCat) { setFormError('Please fill in all required fields'); return }
    const a = parseFloat(amount)
    if (isNaN(a) || a <= 0) { setFormError('Amount must be greater than zero'); return }

    createTransaction(db, currentPeriod.id, todayISO(), selectedCat.name, a, selectedCat.type, selectedCat.id, notes || null)
    await persistDatabase()
    refresh()
    setFormError(null)
    setAmount('')
    setNotes('')
    setSelectedCat(null)
  }

  async function handleDelete(id: number) {
    deleteTransaction(db, id)
    await persistDatabase()
    refresh()
  }

  function getCategoryInfo(catId: number | null) {
    if (!catId) return null
    return categories.find((c) => c.id === catId)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Transactions</h1>

      {!currentPeriod && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Open a period to add transactions.
          </CardContent>
        </Card>
      )}

      {currentPeriod && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {/* Tab toggle + search */}
            <div className="flex items-center gap-3">
              <div className="flex gap-1">
                <Button
                  variant={tab === 'revenue' ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => { setTab('revenue'); setSelectedCat(null) }}
                >
                  Revenue
                </Button>
                <Button
                  variant={tab === 'expense' ? 'default' : 'outline'}
                  size="xs"
                  onClick={() => { setTab('expense'); setSelectedCat(null) }}
                >
                  Expense
                </Button>
              </div>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 h-7 text-xs"
                />
              </div>
            </div>

            {/* Category grid */}
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {activeGroups.map((group) => {
                const visibleCats = search
                  ? group.categories.filter((c) => c.name.toLowerCase().includes(searchLower))
                  : group.categories
                if (visibleCats.length === 0) return null
                return (
                  <div key={group.label}>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                      {group.label}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {visibleCats.map((cat) => (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => selectCategory(cat)}
                          className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors ${
                            selectedCat?.id === cat.id
                              ? tab === 'revenue'
                                ? 'bg-positive/15 border-positive dark:bg-positive/20 dark:border-positive'
                                : 'bg-negative/15 border-negative dark:bg-negative/20 dark:border-negative'
                              : tab === 'revenue'
                                ? 'border-positive/30 hover:bg-positive/5 dark:border-positive/30 dark:hover:bg-positive/10'
                                : 'border-negative/30 hover:bg-negative/5 dark:border-negative/30 dark:hover:bg-negative/10'
                          }`}
                        >
                          <span className="text-[11px]">{cat.icon}</span>
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Inline add form — appears when a category is selected */}
            {selectedCat && (
              <form onSubmit={handleAdd} className="flex items-end gap-2 pt-2 border-t">
                <div className="text-sm font-medium flex items-center gap-1 min-w-0 shrink-0">
                  <span>{selectedCat.icon}</span>
                  <span className="truncate">{selectedCat.name}</span>
                </div>
                <Input
                  ref={amountRef}
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Amount"
                  value={amount}
                  onChange={(e) => { setAmount(e.target.value); setFormError(null) }}
                  className="h-8 w-28 text-sm"
                  required
                />
                <Input
                  placeholder="Notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-8 flex-1 text-sm"
                />
                <Button type="submit" size="sm" className="h-8 shrink-0">Add</Button>
                <Button type="button" variant="ghost" size="sm" className="h-8 shrink-0" onClick={() => { setSelectedCat(null); setFormError(null) }}>
                  Cancel
                </Button>
              </form>
            )}
            {formError && <p className="text-xs text-negative mt-1">{formError}</p>}
          </CardContent>
        </Card>
      )}

      {/* Transaction list */}
      <Card>
        <CardContent noPadding>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">Date</th>
                  <th className="p-3 text-left font-medium">Category</th>
                  <th className="p-3 text-right font-medium">Amount</th>
                  <th className="p-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-muted-foreground">
                      No transactions
                    </td>
                  </tr>
                ) : (
                  transactions.map((t) => {
                    const cat = getCategoryInfo(t.category_id)
                    return (
                      <tr key={t.id} className="border-b hover:bg-muted/30">
                        <td className="p-3 text-muted-foreground">{formatDate(t.date)}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {cat && <span className="text-xs">{cat.icon}</span>}
                            <span className="font-medium">{cat?.name ?? t.label}</span>
                            {t.notes && <span className="text-muted-foreground text-xs">— {t.notes}</span>}
                            <Badge variant={t.type === 'revenue' ? 'success' : 'destructive'} className="ml-auto text-[10px] px-1.5 py-0">
                              {t.type === 'revenue' ? 'Rev' : 'Exp'}
                            </Badge>
                          </div>
                        </td>
                        <td className={`p-3 text-right font-semibold whitespace-nowrap ${t.type === 'revenue' ? 'text-positive' : 'text-negative'}`}>
                          {t.type === 'revenue' ? '+' : '-'}{formatCurrency(t.amount)}
                        </td>
                        <td className="p-3">
                          <Button variant="ghost" size="icon-sm" onClick={() => setConfirmDelete({ id: t.id, label: cat?.name ?? t.label })}>
                            <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null) }}>
        <DialogHeader>
          <DialogTitle>Delete Transaction</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground mb-4">
          Are you sure you want to delete "{confirmDelete?.label}"? This cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { if (confirmDelete) handleDelete(confirmDelete.id); setConfirmDelete(null) }}>Delete</Button>
        </div>
      </Dialog>
    </div>
  )
}
