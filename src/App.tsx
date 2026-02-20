import { useState, useEffect, useCallback } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import type { Database } from 'sql.js'
import { initDatabase } from './db/database'
import { getSetting } from './db/queries'
import { DatabaseContext } from './hooks/useDatabase'
import { Sidebar } from './components/layout/Sidebar'
import { Header } from './components/layout/Header'
import { Dashboard } from './components/Dashboard'
import { Transactions } from './components/Transactions'
import { Assets } from './components/Assets'
import { Leases } from './components/Leases'
import { Loans } from './components/Loans'
import { IncomeStatement } from './components/IncomeStatement'
import { BalanceSheet } from './components/BalanceSheet'
import { Shares } from './components/Shares'
import { Periods } from './components/Periods'
import { Settings } from './components/Settings'
import { SetupWizard } from './components/SetupWizard'

export default function App() {
  const [db, setDb] = useState<Database | null>(null)
  const [version, setVersion] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    initDatabase()
      .then(setDb)
      .catch((err) => setError(String(err)))
  }, [])

  const refresh = useCallback(() => setVersion((v) => v + 1), [])

  const handleDbChange = useCallback(() => {
    initDatabase().then((newDb) => {
      setDb(newDb)
      setVersion((v) => v + 1)
    })
  }, [])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-red-600">Loading Error</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (!db) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-2">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Loading database...</p>
        </div>
      </div>
    )
  }

  const setupComplete = getSetting(db, 'setup_complete') === '1'

  if (!setupComplete) {
    return <SetupWizard db={db} onComplete={handleDbChange} />
  }

  return (
    <DatabaseContext.Provider value={{ db, refresh, version }}>
      <HashRouter>
        <div className="min-h-screen flex">
          <Sidebar />
          <div className="flex-1 ml-64">
            <Header />
            <main className="p-6">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/assets" element={<Assets />} />
                <Route path="/leases" element={<Leases />} />
                <Route path="/loans" element={<Loans />} />
                <Route path="/income-statement" element={<IncomeStatement />} />
                <Route path="/balance-sheet" element={<BalanceSheet />} />
                <Route path="/shares" element={<Shares />} />
                <Route path="/periods" element={<Periods />} />
                <Route path="/settings" element={<Settings onDbChange={handleDbChange} />} />
              </Routes>
            </main>
          </div>
        </div>
      </HashRouter>
    </DatabaseContext.Provider>
  )
}
