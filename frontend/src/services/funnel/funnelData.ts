// Loads what the funnel (TODO-076) needs once: every building column with positions, and the residents' survey for
// "a barri its residents like" when that data is on.
import { features } from '../../features'
import { loadBuildings, type BuildingData } from '../buildings/buildingData'
import { loadBarriVibe } from '../localsOpinion/localsOpinion'
import { FUNNEL_CONFIG } from './funnelConfig'
import { buildFunnelData, type FunnelData } from './funnelWishes'

export interface LoadedFunnel {
  buildings: BuildingData
  fd: FunnelData
}

let cache: Promise<LoadedFunnel> | null = null

export function loadFunnelData(): Promise<LoadedFunnel> {
  cache ??= Promise.all([loadBuildings(), features.localsOpinion ? loadBarriVibe() : null])
    .then(([buildings, vibe]) => ({ buildings, fd: buildFunnelData(buildings, vibe, FUNNEL_CONFIG.minDwellings) }))
    .catch((err) => {
      cache = null
      throw err
    })
  return cache
}

export function resetFunnelDataCache(): void {
  cache = null
}
