import { useEffect, useState } from 'react'
import { loadScores } from '../services/buildings/buildingData'

/**
 * The `dwellings` column (TODO-073): how many homes each building counts for in shares and ranks. Read from the
 * scores file the map loads anyway (the promise is cached), so it is there as soon as the scores are. Undefined
 * before that, or in data built before 073 (every building then counts once).
 */
export function useHomes(): Float32Array | undefined {
  const [homes, setHomes] = useState<Float32Array | undefined>(undefined)
  useEffect(() => {
    let live = true
    loadScores()
      .then((d) => { if (live) setHomes(d.cols.dwellings) })
      .catch(() => { /* the map reports a failed load; shares then count buildings */ })
    return () => { live = false }
  }, [])
  return homes
}
