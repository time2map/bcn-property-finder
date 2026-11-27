import type { AreaFeature } from '../areas'
import { loadBuildingsMeta, type BuildingData, type BuildingsMeta } from '../buildings/buildingData'
import { scoreAll } from '../buildings/buildingScore'
import { firstVisitSettings, settingsKey } from '../buildings/firstVisit'
import type { BarriVibeData } from '../localsOpinion/localsOpinion'
import type { ConditionId } from '../match/matchSummary'
import { joinAreas } from './areaJoin'
import { rankAreas, type AreaRank } from './areaRank'
import { dataUrl } from '../dataUrl'

// The area view at start without the building data (TODO-058). The build (scripts/build-area-start.mjs) writes
// dist/data/area-start.json: which polygon of areas.geojson each area of the data is, and the ranks of the areas
// for the settings of a first visit. The first view (areas, zoom 12) is coloured from it, before the 1 MB of
// scores has arrived; the scoring then replaces the ranks with the same values.

export const AREA_START_FILE = 'area-start.json'

export interface AreaStart {
  version: 1
  /** `generated` and `count` of the building data it was computed from. */
  generated: string | null
  count: number
  /** settingsKey() of the settings the ranks are for. */
  key: string
  /** Area index (meta.areas) → `properties.id` of its polygon in areas.geojson. */
  join: Record<string, string>
  ranks: AreaRank[]
}

/** Computes the file (at build time). `data` must have the positions; `withComponents` as the map scores them. */
export function computeAreaStart(data: BuildingData, features: readonly AreaFeature[], vibe: BarriVibeData | null): AreaStart {
  const settings = firstVisitSettings()
  const { cols, meta } = data
  const join = joinAreas(meta.areas, cols.area, cols.lng, cols.lat, features)
  const { score, gap, components } = scoreAll(data, { ...settings, vibe }, true)
  const on = (Object.keys(components!) as ConditionId[]).filter((k) => (settings.weights[k] ?? 0) > 0)
  return {
    version: 1,
    generated: meta.generated ?? null,
    count: meta.count,
    key: settingsKey(settings),
    join: Object.fromEntries([...join].map(([index, f]) => [String(index), f.properties.id])),
    ranks: rankAreas(score, cols.area, meta.areas, components!, on, undefined, undefined, gap, undefined, cols.dwellings),
  }
}

/** True when the file was computed from this building data. */
export function matchesData(start: AreaStart, meta: Pick<BuildingsMeta, 'generated' | 'count'>): boolean {
  return start.version === 1 && start.count === meta.count && start.generated === (meta.generated ?? null)
}

/** Area index → polygon from the file; null when a polygon is missing (areas.geojson changed). */
export function joinFromStart(start: AreaStart, features: readonly AreaFeature[]): Map<number, AreaFeature> | null {
  const byId = new Map(features.map((f) => [f.properties.id, f]))
  const join = new Map<number, AreaFeature>()
  for (const [index, id] of Object.entries(start.join)) {
    const f = byId.get(id)
    if (!f) return null
    join.set(Number(index), f)
  }
  return join.size > 0 ? join : null
}

let cache: Promise<AreaStart | null> | null = null

/** The file, when the build wrote one for the building data the app has; else null (dev server, old file). */
export function loadAreaStart(): Promise<AreaStart | null> {
  cache ??= Promise.all([
    fetch(dataUrl(AREA_START_FILE)).then((r) => (r.ok ? (r.json() as Promise<AreaStart>) : null)),
    loadBuildingsMeta(),
  ])
    .then(([start, meta]) => (start && matchesData(start, meta) ? start : null))
    .catch(() => null)
  return cache
}

export function resetAreaStartCache(): void {
  cache = null
}
