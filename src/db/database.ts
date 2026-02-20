import initSqlJs, { type Database } from 'sql.js'
import schema from './schema.sql?raw'
import { seedDatabase } from './seed'
import wasmBase64 from 'virtual:sql-wasm'

const DB_NAME = 'fs25accounting'
const DB_STORE = 'databases'
const DB_KEY = 'main'

let db: Database | null = null

function decodeBase64(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

const wasmBinary = decodeBase64(wasmBase64)

function getSQL() {
  return initSqlJs({ wasmBinary })
}

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore(DB_STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function loadFromIndexedDB(): Promise<Uint8Array | null> {
  const idb = await openIndexedDB()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(DB_STORE, 'readonly')
    const store = tx.objectStore(DB_STORE)
    const request = store.get(DB_KEY)
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => reject(request.error)
  })
}

async function saveToIndexedDB(data: Uint8Array): Promise<void> {
  const idb = await openIndexedDB()
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(DB_STORE, 'readwrite')
    const store = tx.objectStore(DB_STORE)
    const request = store.put(data, DB_KEY)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

function createFreshDb(SQL: Awaited<ReturnType<typeof getSQL>>): Database {
  const fresh = new SQL.Database()
  fresh.exec(schema)
  seedDatabase(fresh)
  return fresh
}

function migrateDatabase(database: Database): void {
  // Add columns introduced after initial release.
  // ALTER TABLE … ADD COLUMN fails if the column already exists,
  // so we just swallow the error in each case.
  const columnMigrations = [
    `ALTER TABLE asset ADD COLUMN accumulated_depreciation REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE period ADD COLUMN depreciation_booked REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE lease ADD COLUMN interest_rate REAL NOT NULL DEFAULT 0`,
    `ALTER TABLE lease ADD COLUMN remaining_balance REAL NOT NULL DEFAULT 0`,
  ]
  for (const sql of columnMigrations) {
    try { database.run(sql) } catch { /* column already exists */ }
  }

  // Rename old categories
  try { database.run(`UPDATE category SET name = 'Worker Wages' WHERE name = 'Salaries'`) } catch { /* */ }
  try { database.run(`UPDATE category SET name = 'Maintenance' WHERE name = 'Maintenance / Repairs'`) } catch { /* */ }

  // Ensure all expected categories exist (idempotent)
  const expectedCategories: [string, string, string][] = [
    // Revenue: Grains
    ['Wheat', 'revenue', '\u{1F33E}'], ['Barley', 'revenue', '\u{1F33E}'], ['Oat', 'revenue', '\u{1F33E}'],
    ['Canola', 'revenue', '\u{1F33B}'], ['Corn', 'revenue', '\u{1F33D}'], ['Sorghum', 'revenue', '\u{1F33E}'],
    ['Soybean', 'revenue', '\u{1FAD8}'], ['Sunflower', 'revenue', '\u{1F33B}'],
    ['Rice', 'revenue', '\u{1F35A}'], ['Long Grain Rice', 'revenue', '\u{1F35A}'],
    // Revenue: Root Crops
    ['Potato', 'revenue', '\u{1F954}'], ['Sugar Beet', 'revenue', '\u{1F7E3}'],
    ['Sugarcane', 'revenue', '\u{1F38B}'], ['Red Beet', 'revenue', '\u{1F7E3}'],
    ['Carrots', 'revenue', '\u{1F955}'], ['Parsnip', 'revenue', '\u{1F955}'],
    // Revenue: Vegetables & Herbs
    ['Spinach', 'revenue', '\u{1F96C}'], ['Peas', 'revenue', '\u{1F7E2}'],
    ['Green Beans', 'revenue', '\u{1FAD1}'], ['Lettuce', 'revenue', '\u{1F96C}'],
    ['Tomatoes', 'revenue', '\u{1F345}'], ['Cabbage', 'revenue', '\u{1F96C}'],
    ['Chili', 'revenue', '\u{1F336}\u{FE0F}'], ['Garlic', 'revenue', '\u{1F9C4}'],
    ['Spring Onion', 'revenue', '\u{1F9C5}'],
    // Revenue: Fruits & Mushrooms
    ['Grapes', 'revenue', '\u{1F347}'], ['Olives', 'revenue', '\u{1FAD2}'],
    ['Strawberries', 'revenue', '\u{1F353}'], ['Mushrooms', 'revenue', '\u{1F344}'],
    // Revenue: Forage & Fiber
    ['Grass', 'revenue', '\u{1F33F}'], ['Hay', 'revenue', '\u{1F33E}'],
    ['Straw', 'revenue', '\u{1F33E}'], ['Silage', 'revenue', '\u{1F7E2}'],
    ['Cotton', 'revenue', '\u{1F9F5}'], ['Poplar', 'revenue', '\u{1F333}'],
    // Revenue: Livestock
    ['Cattle', 'revenue', '\u{1F404}'], ['Pigs', 'revenue', '\u{1F437}'],
    ['Sheep', 'revenue', '\u{1F411}'], ['Chickens', 'revenue', '\u{1F414}'],
    ['Horses', 'revenue', '\u{1F434}'], ['Goats', 'revenue', '\u{1F410}'],
    ['Water Buffalo', 'revenue', '\u{1F403}'],
    // Revenue: Animal Products
    ['Milk', 'revenue', '\u{1F95B}'], ['Eggs', 'revenue', '\u{1F95A}'],
    ['Wool', 'revenue', '\u{1F9F6}'], ['Honey', 'revenue', '\u{1F36F}'],
    // Revenue: Forestry
    ['Wood', 'revenue', '\u{1FAB5}'], ['Wood Chips', 'revenue', '\u{1FAB5}'], ['Planks', 'revenue', '\u{1FAB5}'],
    // Revenue: Dairy
    ['Butter', 'revenue', '\u{1F9C8}'], ['Cheese', 'revenue', '\u{1F9C0}'],
    ['Goat Cheese', 'revenue', '\u{1F9C0}'], ['Buffalo Mozzarella', 'revenue', '\u{1F9C0}'],
    ['Bottled Milk', 'revenue', '\u{1F95B}'],
    // Revenue: Oils
    ['Sunflower Oil', 'revenue', '\u{1F33B}'], ['Olive Oil', 'revenue', '\u{1FAD2}'],
    ['Canola Oil', 'revenue', '\u{1F33B}'],
    // Revenue: Bakery & Processed Food
    ['Flour', 'revenue', '\u{1FAD3}'], ['Rice Flour', 'revenue', '\u{1F35A}'],
    ['Sugar', 'revenue', '\u{1F36C}'], ['Bread', 'revenue', '\u{1F35E}'],
    ['Cake', 'revenue', '\u{1F382}'], ['Cereal', 'revenue', '\u{1F963}'],
    ['Chocolate', 'revenue', '\u{1F36B}'], ['Potato Chips', 'revenue', '\u{1F35F}'],
    // Revenue: Preserved & Packed
    ['Raisins', 'revenue', '\u{1F347}'], ['Grape Juice', 'revenue', '\u{1F9C3}'],
    ['Soup', 'revenue', '\u{1F372}'], ['Kimchi', 'revenue', '\u{1F96C}'],
    ['Canned Vegetables', 'revenue', '\u{1F96B}'],
    // Revenue: Textiles
    ['Fabric', 'revenue', '\u{1F9F5}'], ['Clothes', 'revenue', '\u{1F455}'],
    ['Rope', 'revenue', '\u{1FA22}'],
    // Revenue: Crafted & Industrial
    ['Furniture', 'revenue', '\u{1FA91}'], ['Piano', 'revenue', '\u{1F3B9}'],
    ['Paper', 'revenue', '\u{1F4C4}'], ['Barrels', 'revenue', '\u{1F6E2}\u{FE0F}'],
    ['Wagons', 'revenue', '\u{1F6D2}'], ['Toy Tractors', 'revenue', '\u{1F9F8}'],
    // Revenue: Construction
    ['Cement', 'revenue', '\u{1F9F1}'], ['Concrete Tiles', 'revenue', '\u{1F9F1}'],
    ['Roof Tiles', 'revenue', '\u{1F9F1}'], ['Prefab Walls', 'revenue', '\u{1F9F1}'],
    // Revenue: Contract Income & Other
    ['Contracts', 'revenue', '\u{1F4CB}'], ['Missions', 'revenue', '\u{1F3AF}'],
    ['Subsidies', 'revenue', '\u{1F3DB}\u{FE0F}'], ['Capital Gain', 'revenue', '\u{1F4C8}'],
    ['Other Revenue', 'revenue', '\u{1F4B0}'],
    // Expense: Inputs
    ['Seeds', 'expense', '\u{1F331}'], ['Fertilizer', 'expense', '\u{1F9EA}'],
    ['Lime', 'expense', '\u{26AA}'], ['Herbicide', 'expense', '\u{1F9F4}'],
    // Expense: Operations
    ['Fuel', 'expense', '\u{26FD}'], ['Worker Wages', 'expense', '\u{1F477}'],
    ['Maintenance', 'expense', '\u{1F527}'], ['Hand Tools', 'expense', '\u{1F9F0}'],
    ['Vehicle Rent', 'expense', '\u{1F69C}'],
    // Expense: Animals
    ['Animal Feed', 'expense', '\u{1F33F}'],
    // Expense: Financial & Exceptional
    ['Lease Interest', 'expense', '\u{1F4C4}'], ['Loan Interest', 'expense', '\u{1F3E6}'],
    ['Capital Loss', 'expense', '\u{1F4C9}'], ['Other Expenses', 'expense', '\u{1F4E6}'],
    // Expense: Tax
    ['Corporate Tax', 'expense', '\u{1F3DB}\u{FE0F}'],
  ]
  for (const [name, type, icon] of expectedCategories) {
    try {
      const exists = database.exec(`SELECT 1 FROM category WHERE name = '${name.replace(/'/g, "''")}' AND type = '${type}'`)
      if (exists.length === 0 || exists[0].values.length === 0) {
        database.run(`INSERT INTO category (name, type, icon) VALUES (?, ?, ?)`, [name, type, icon])
      }
    } catch { /* */ }
  }
}

export async function initDatabase(): Promise<Database> {
  const SQL = await getSQL()

  try {
    const saved = await loadFromIndexedDB()
    if (saved) {
      db = new SQL.Database(saved)
      // Sanity check: verify the DB has the expected tables
      const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='category'")
      if (tables.length === 0 || tables[0].values.length === 0) {
        throw new Error('stale db')
      }
      migrateDatabase(db)
      return db
    }
  } catch {
    // IndexedDB failed or DB was corrupt — start fresh
  }

  db = createFreshDb(SQL)
  try { await persistDatabase() } catch { /* file:// may not support IndexedDB */ }
  return db
}

export async function persistDatabase(): Promise<void> {
  if (!db) return
  try {
    const data = db.export()
    await saveToIndexedDB(data)
  } catch {
    // IndexedDB may not be available (e.g. file:// protocol)
  }
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database not initialized')
  return db
}

export function exportDatabase(): Uint8Array {
  if (!db) throw new Error('Database not initialized')
  return db.export()
}

export async function importDatabase(data: Uint8Array): Promise<Database> {
  const SQL = await getSQL()
  db = new SQL.Database(data)
  await persistDatabase()
  return db
}

export async function resetDatabase(): Promise<Database> {
  const SQL = await getSQL()
  db = createFreshDb(SQL)
  await persistDatabase()
  return db
}
