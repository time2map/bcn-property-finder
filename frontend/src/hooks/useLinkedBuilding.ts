import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { useBuildingData } from './useBuildingData'
import { nearestBuilding, parseBuildingParam } from '../services/buildingLink'

/**
 * A link made by "Share" on a building card carries `b=<lng>,<lat>` (TODO-064): once the building data is in, that
 * building is selected and its card opens. Read once at start, before the address is rewritten.
 */
export function useLinkedBuilding(): void {
  const [target] = useState(() => parseBuildingParam(new URLSearchParams(window.location.search).get('b')))
  const done = useRef(false)
  const data = useBuildingData(target !== null)
  useEffect(() => {
    if (!target || !data || done.current) return
    done.current = true
    const row = nearestBuilding(data.cols.lng, data.cols.lat, target[0], target[1])
    if (row !== null) useStore.getState().setSelectedBuilding(row)
  }, [target, data])
}
