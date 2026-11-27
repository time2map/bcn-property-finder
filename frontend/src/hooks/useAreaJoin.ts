import { useEffect, useState } from 'react'
import type { AreaFeature } from '../services/areas'
import { loadAreaJoin } from '../services/areas/areaJoinLoader'

/** Area index → polygon; null until the building data and the areas have loaded (or if they cannot). */
export function useAreaJoin(): Map<number, AreaFeature> | null {
  const [join, setJoin] = useState<Map<number, AreaFeature> | null>(null)
  useEffect(() => {
    let live = true
    loadAreaJoin().then((j) => { if (live) setJoin(j) }).catch(() => { /* the map layers report it */ })
    return () => { live = false }
  }, [])
  return join
}
