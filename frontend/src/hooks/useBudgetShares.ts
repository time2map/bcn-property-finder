import { useEffect, useState } from 'react'
import { buildingData, loadScores, type BuildingData } from '../services/buildings/buildingData'
import { shareUnder, sortedPrices } from '../services/conditionOptions'

/** "≈ N % of homes" for a budget: undefined until the building data has loaded (or when it cannot load). */
export function useBudgetShares(): ((limit: number) => number) | undefined {
  const [data, setData] = useState<BuildingData | null>(buildingData)
  useEffect(() => {
    if (data) return
    let live = true
    try {
      loadScores().then((d) => { if (live) setData(d) }).catch(() => { /* the map reports it */ })
    } catch { /* no fetch (tests) */ }
    return () => { live = false }
  }, [data])
  if (!data) return undefined
  const prices = sortedPrices(data)
  return (limit) => shareUnder(prices, limit)
}
