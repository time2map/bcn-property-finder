import type { MultiPolygon, Polygon } from 'geojson'

/** Source of an exclusion zone: hand-drawn on the map, or picked from the areas dataset. */
export type ExclusionSource = 'drawn' | 'area'

/** A "no-go" zone that is statically subtracted from the exported area. */
export interface ExclusionZone {
  id: string
  name: string
  source: ExclusionSource
  /** Optional id from the areas dataset (district/barri/municipality), for 'area' zones. */
  areaId?: string
  geometry: Polygon | MultiPolygon
}
