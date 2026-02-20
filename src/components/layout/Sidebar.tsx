import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useDatabase } from '@/hooks/useDatabase'
import { getSetting } from '@/db/queries'
import {
  LayoutDashboard,
  Receipt,
  Truck,
  FileText,
  Landmark,
  BarChart3,
  Scale,
  PieChart,
  Calendar,
  Settings,
  Tractor,
} from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/transactions', icon: Receipt, label: 'Transactions' },
  { to: '/assets', icon: Truck, label: 'Assets' },
  { to: '/leases', icon: FileText, label: 'Leases' },
  { to: '/loans', icon: Landmark, label: 'Loans' },
  { to: '/income-statement', icon: BarChart3, label: 'Income Statement' },
  { to: '/balance-sheet', icon: Scale, label: 'Balance Sheet' },
  { to: '/shares', icon: PieChart, label: 'Shares & Investors' },
  { to: '/periods', icon: Calendar, label: 'Periods' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export function Sidebar() {
  const { db } = useDatabase()
  const saveName = getSetting(db, 'save_name')

  return (
    <aside className="fixed left-0 top-0 h-full w-64 border-r bg-sidebar-background flex flex-col">
      <div className="flex items-center gap-2 p-4 border-b">
        <Tractor className="h-6 w-6 text-primary shrink-0" />
        <div className="min-w-0">
          <span className="font-bold text-lg block">FS25 Accounting</span>
          {saveName && <span className="text-xs text-muted-foreground truncate block">{saveName}</span>}
        </div>
      </div>
      <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50',
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
