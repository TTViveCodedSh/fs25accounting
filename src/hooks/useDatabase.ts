import { createContext, useContext } from 'react'
import type { Database } from 'sql.js'

interface DatabaseContextValue {
  db: Database
  refresh: () => void
  version: number
}

export const DatabaseContext = createContext<DatabaseContextValue | null>(null)

export function useDatabase(): DatabaseContextValue {
  const ctx = useContext(DatabaseContext)
  if (!ctx) throw new Error('useDatabase must be used within a DatabaseProvider')
  return ctx
}
