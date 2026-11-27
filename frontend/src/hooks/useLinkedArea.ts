import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { useAreaJoin } from './useAreaJoin'
import { selectAreaFeature } from '../services/areas/areaSelect'

/**
 * A link to an area (the share page of a barri, or "Share" on an area card) carries `a=<area code>` (TODO-064): once
 * the ranks and the polygons are in, the map flies to that area and its card opens. Read once at start, before the
 * address is rewritten.
 */
export function useLinkedArea(): void {
  const [code] = useState(() => new URLSearchParams(window.location.search).get('a'))
  const ranks = useStore((s) => s.areaRanks)
  const join = useAreaJoin()
  const done = useRef(false)
  useEffect(() => {
    if (!code || done.current || !ranks || !join) return
    done.current = true
    const rank = ranks.find((r) => r.code === code)
    const feature = rank && join.get(rank.index)
    if (rank && feature) selectAreaFeature(feature, rank.index)
  }, [code, ranks, join])
}
