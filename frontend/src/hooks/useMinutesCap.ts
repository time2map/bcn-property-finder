import { useEffect, useState } from 'react'
import { DEFAULT_MINUTES_CAP, loadBuildingsMeta, minutesCapOf, type MinutesCap } from '../services/buildings/buildingData'

/** How far the walking minutes of the data reach (TODO-073), for the texts; the old reach until the meta is in. */
export function useMinutesCap(): MinutesCap {
  const [cap, setCap] = useState<MinutesCap>(DEFAULT_MINUTES_CAP)
  useEffect(() => {
    let live = true
    loadBuildingsMeta().then((m) => { if (live) setCap(minutesCapOf(m)) }).catch(() => { /* keep the default */ })
    return () => { live = false }
  }, [])
  return cap
}
