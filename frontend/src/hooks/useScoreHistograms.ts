import { useMemo } from 'react'
import { useBuildingData } from './useBuildingData'
import { scoreHistograms, type ScoreHistograms } from '../services/buildings/buildingRank'
import { useStore } from '../store'

/**
 * The score histograms of the barris, of Barcelona and of the whole data (TODO-070), by homes (TODO-073), rebuilt
 * after each rescoring.
 * Null until the scores and the building areas are there. One pass over ~170k scores: a few milliseconds, so it
 * runs on the main thread from the scores the map already holds.
 */
export function useScoreHistograms(): ScoreHistograms | null {
  const scores = useStore((s) => s.buildingScores)
  const data = useBuildingData(false)
  return useMemo(
    () => (scores && data?.cols.area ? scoreHistograms(scores, data.cols.area, data.meta.areas, data.cols.dwellings) : null),
    [scores, data],
  )
}
