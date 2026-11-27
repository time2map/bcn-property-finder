import { useEffect, useState } from 'react'
import { buildingData, loadBuildings, type BuildingData } from '../services/buildings/buildingData'

/**
 * All the building columns, positions included (the card, the facade points). Null until they have loaded; asks
 * for them when `wanted`. The map is coloured before the positions arrive (TODO-058), so a building can be picked
 * a moment before its card can show: it shows once they are there.
 */
export function useBuildingData(wanted: boolean): BuildingData | null {
  const [data, setData] = useState<BuildingData | null>(buildingData)
  useEffect(() => {
    if (!wanted || data || buildingData) return
    let live = true
    loadBuildings().then((d) => { if (live) setData(d) }).catch((err) => console.error('Building data failed to load', err))
    return () => { live = false }
  }, [wanted, data])
  return data ?? buildingData
}
