import { useState } from 'react'
import { useDatabase } from '@/hooks/useDatabase'
import { getFiscalYears, getPeriods, sumTransactionsByCategory } from '@/db/queries'
import { getPeriodDepreciation } from '@/lib/calculations'
import { formatCurrency } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Select } from './ui/select'
import { Label } from './ui/label'
import { ChevronDown, ChevronRight } from 'lucide-react'

// --- Classification into French accounting sections ---

const FINANCIAL_EXPENSE_CATS = ['Loan Interest', 'Lease Interest']
const EXCEPTIONAL_REVENUE_CATS = ['Capital Gain', 'Other Revenue']
const EXCEPTIONAL_EXPENSE_CATS = ['Capital Loss', 'Other Expenses']
const TAX_EXPENSE_CATS = ['Corporate Tax']

type CatRow = { category_id: number; category_name: string; icon: string; total: number }

function classifyRows(rows: CatRow[], exceptionalNames: string[]) {
  const operating: CatRow[] = []
  const exceptional: CatRow[] = []
  for (const r of rows) {
    if (exceptionalNames.includes(r.category_name)) {
      exceptional.push(r)
    } else {
      operating.push(r)
    }
  }
  return { operating, exceptional }
}

function classifyExpenseRows(rows: CatRow[]) {
  const operating: CatRow[] = []
  const financial: CatRow[] = []
  const exceptional: CatRow[] = []
  const tax: CatRow[] = []
  for (const r of rows) {
    if (TAX_EXPENSE_CATS.includes(r.category_name)) {
      tax.push(r)
    } else if (FINANCIAL_EXPENSE_CATS.includes(r.category_name)) {
      financial.push(r)
    } else if (EXCEPTIONAL_EXPENSE_CATS.includes(r.category_name)) {
      exceptional.push(r)
    } else {
      operating.push(r)
    }
  }
  return { operating, financial, exceptional, tax }
}

function sumRows(rows: CatRow[]): number {
  return rows.reduce((s, r) => s + r.total, 0)
}

// --- Collapsible line component ---

function SectionLine({
  label,
  total,
  rows,
  color,
  defaultExpanded = false,
}: {
  label: string
  total: number
  rows: CatRow[]
  color: 'green' | 'red' | 'muted'
  defaultExpanded?: boolean
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const colorClass = color === 'green' ? 'text-positive' : color === 'red' ? 'text-negative' : 'text-muted-foreground'

  if (rows.length === 0 && total === 0) {
    return (
      <div className="flex justify-between text-sm py-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-muted-foreground">{formatCurrency(0)}</span>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full justify-between items-center text-sm py-1 hover:bg-muted/30 rounded -mx-1 px-1 transition-colors"
      >
        <span className="flex items-center gap-1 font-medium">
          {rows.length > 0 ? (
            expanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          ) : <span className="w-3.5" />}
          {label}
        </span>
        <span className={`font-semibold ${colorClass}`}>{formatCurrency(total)}</span>
      </button>
      {expanded && rows.length > 0 && (
        <div className="ml-5 space-y-0.5 mb-1">
          {rows.map((r) => (
            <div key={r.category_id ?? 'none'} className="flex justify-between text-xs text-muted-foreground">
              <span>{r.icon} {r.category_name ?? 'Uncategorized'}</span>
              <span>{formatCurrency(r.total)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// --- Main component ---

export function IncomeStatement() {
  const { db } = useDatabase()
  const fiscalYears = getFiscalYears(db)
  const [selectedFY, setSelectedFY] = useState<number>(fiscalYears[fiscalYears.length - 1]?.id ?? 0)
  const [selectedPeriod, setSelectedPeriod] = useState<number | 'year'>('year')

  const periods = selectedFY ? getPeriods(db, selectedFY) : []

  const periodId = selectedPeriod !== 'year' ? selectedPeriod : undefined
  const fiscalYearId = selectedPeriod === 'year' ? selectedFY : undefined

  const revenueByCategory = sumTransactionsByCategory(db, 'revenue', fiscalYearId, periodId)
  const expenseByCategory = sumTransactionsByCategory(db, 'expense', fiscalYearId, periodId)
  const depreciation = selectedFY ? getPeriodDepreciation(db, fiscalYearId, periodId) : 0

  // Classify into sections
  const revSections = classifyRows(revenueByCategory, EXCEPTIONAL_REVENUE_CATS)
  const expSections = classifyExpenseRows(expenseByCategory)

  const operatingRevenue = sumRows(revSections.operating)
  const operatingExpenses = sumRows(expSections.operating) + depreciation
  const operatingResult = operatingRevenue - operatingExpenses

  const financialExpenses = sumRows(expSections.financial)
  const financialResult = -financialExpenses

  const exceptionalRevenue = sumRows(revSections.exceptional)
  const exceptionalExpenses = sumRows(expSections.exceptional)
  const exceptionalResult = exceptionalRevenue - exceptionalExpenses

  const profitBeforeTax = operatingResult + financialResult + exceptionalResult
  const taxExpenses = sumRows(expSections.tax)
  const netProfit = profitBeforeTax - taxExpenses

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Income Statement</h1>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Label>Fiscal Year:</Label>
          <Select value={String(selectedFY)} onChange={(e) => { setSelectedFY(Number(e.target.value)); setSelectedPeriod('year') }} className="w-40">
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>{fy.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label>Period:</Label>
          <Select value={String(selectedPeriod)} onChange={(e) => setSelectedPeriod(e.target.value === 'year' ? 'year' : Number(e.target.value))} className="w-40">
            <option value="year">Full Year</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* Operating */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Operating</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <SectionLine label="Revenue" total={operatingRevenue} rows={revSections.operating} color="green" />
          <SectionLine
            label="Expenses"
            total={operatingExpenses}
            rows={[
              ...expSections.operating,
              ...(depreciation > 0 ? [{ category_id: -1, category_name: 'Depreciation', icon: '📊', total: depreciation }] : []),
            ]}
            color="red"
          />
          <div className="border-t pt-2 flex justify-between font-bold text-sm">
            <span>Operating Result</span>
            <span className={operatingResult >= 0 ? 'text-positive' : 'text-negative'}>
              {formatCurrency(operatingResult)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Financial */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Financial</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <SectionLine label="Expenses" total={financialExpenses} rows={expSections.financial} color="red" />
          <div className="border-t pt-2 flex justify-between font-bold text-sm">
            <span>Financial Result</span>
            <span className={financialResult >= 0 ? 'text-positive' : 'text-negative'}>
              {formatCurrency(financialResult)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Exceptional */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Exceptional</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <SectionLine label="Revenue" total={exceptionalRevenue} rows={revSections.exceptional} color="green" />
          <SectionLine label="Expenses" total={exceptionalExpenses} rows={expSections.exceptional} color="red" />
          <div className="border-t pt-2 flex justify-between font-bold text-sm">
            <span>Exceptional Result</span>
            <span className={exceptionalResult >= 0 ? 'text-positive' : 'text-negative'}>
              {formatCurrency(exceptionalResult)}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Profit Before Tax */}
      <Card>
        <CardContent className="p-4 flex justify-between items-center">
          <span className="text-sm font-medium text-muted-foreground">Profit Before Tax</span>
          <span className={`text-xl font-bold ${profitBeforeTax >= 0 ? 'text-positive' : 'text-negative'}`}>
            {profitBeforeTax >= 0 ? '+' : ''}{formatCurrency(profitBeforeTax)}
          </span>
        </CardContent>
      </Card>

      {/* Corporate Tax */}
      {taxExpenses > 0 && (
        <Card>
          <CardContent className="p-4 flex justify-between items-center">
            <span className="text-sm font-medium text-muted-foreground">Corporate Tax</span>
            <span className="text-xl font-bold text-negative">-{formatCurrency(taxExpenses)}</span>
          </CardContent>
        </Card>
      )}

      {/* Net Profit */}
      <Card className={netProfit >= 0 ? 'border-positive/30 bg-positive/5 dark:border-positive/30 dark:bg-positive/10' : 'border-negative/30 bg-negative/5 dark:border-negative/30 dark:bg-negative/10'}>
        <CardContent className="p-6 flex justify-between items-center">
          <span className="text-sm font-medium text-muted-foreground">Net Profit</span>
          <span className={`text-3xl font-bold ${netProfit >= 0 ? 'text-positive' : 'text-negative'}`}>
            {netProfit >= 0 ? '+' : ''}{formatCurrency(netProfit)}
          </span>
        </CardContent>
      </Card>
    </div>
  )
}
