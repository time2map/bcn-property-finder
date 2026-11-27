import { loadAreas, type AreaFeature } from '../areas'
import { loadBuildings } from '../buildings/buildingData'
import { joinAreas } from './areaJoin'
import { joinFromStart, loadAreaStart } from './areaStart'

let cache: Promise<Map<number, AreaFeature>> | null = null

/**
 * Area index → polygon (cached). From area-start.json when the build wrote it (TODO-058): then only the areas
 * are loaded; otherwise matched here from the positions of the buildings.
 */
export function loadAreaJoin(): Promise<Map<number, AreaFeature>> {
  if (!cache) {
    try {
      cache = Promise.all([loadAreaStart(), loadAreas()])
        .then(([start, features]) => (start && joinFromStart(start, features))
          ?? loadBuildings().then((data) => joinAreas(data.meta.areas, data.cols.area, data.cols.lng, data.cols.lat, features)))
        .catch((err) => { cache = null; throw err })
    } catch (err) {
      return Promise.reject(err)
    }
  }
  return cache
}

/** Test helper — clears the module-level cache. */
export function resetAreaJoinCache(): void {
  cache = null
}
