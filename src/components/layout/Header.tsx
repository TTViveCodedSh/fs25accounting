import { useDatabase } from '@/hooks/useDatabase'
import { useTheme } from '@/hooks/useTheme'
import { getCashBalance, getSharePrice } from '@/lib/calculations'
import { getCurrentPeriod } from '@/db/queries'
import { formatCurrency } from '@/lib/utils'
import { Sun, Moon } from 'lucide-react'

export function Header() {
  const { db } = useDatabase()
  const { dark, toggle } = useTheme()
  const cash = getCashBalance(db)
  const sharePrice = getSharePrice(db)
  const period = getCurrentPeriod(db)

  return (
    <header className="sticky top-0 z-10 h-14 border-b bg-background/95 backdrop-blur flex items-center justify-between px-6">
      <div className="text-sm text-muted-foreground">
        {period ? period.name : 'No open period'}
      </div>
      <div className="flex items-center gap-6">
        <div className="text-sm">
          <span className="text-muted-foreground">Cash:</span>{' '}
          <span className={cash >= 0 ? 'text-positive font-semibold' : 'text-negative font-semibold'}>
            {formatCurrency(cash)}
          </span>
        </div>
        <div className="text-sm">
          <span className="text-muted-foreground">Share:</span>{' '}
          <span className="font-semibold">{formatCurrency(sharePrice)}</span>
        </div>
        <button
          onClick={toggle}
          className="p-2 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
      </div>
    </header>
  )
}
