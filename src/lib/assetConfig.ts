import type { Database } from 'sql.js'
import { getSetting } from '@/db/queries'
import { Truck, Wrench, Building, MapPin } from 'lucide-react'

export function getAssetTypeConfig(db: Database) {
  const depVehicle = parseInt(getSetting(db, 'dep_years_vehicle') ?? '5')
  const depImplement = parseInt(getSetting(db, 'dep_years_implement') ?? '5')
  const depBuilding = parseInt(getSetting(db, 'dep_years_building') ?? '10')
  return {
    vehicle: { label: 'Tractor / Vehicle', icon: Truck, depYears: depVehicle as number | null },
    implement: { label: 'Implement / Tool', icon: Wrench, depYears: depImplement as number | null },
    building: { label: 'Building', icon: Building, depYears: depBuilding as number | null },
    land: { label: 'Land', icon: MapPin, depYears: null as number | null },
  }
}
