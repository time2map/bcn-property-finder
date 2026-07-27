import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'

export type AreaKind = 'district' | 'barri' | 'municipality'

export interface AreaProps {
  id: string
  name: string
  kind: AreaKind
  /** For barris: the id of the containing district. */
  parent?: string
}

export type AreaFeature = Feature<Polygon | MultiPolygon, AreaProps>

export interface AreaOptionGroup {
  group: string
  items: { value: string; label: string }[]
}

let cache: Promise<AreaFeature[]> | null = null

/** Loads the areas dataset (cached). */
export async function loadAreas(url = `${import.meta.env.BASE_URL}data/areas.geojson`): Promise<AreaFeature[]> {
  if (!cache) {
    cache = fetch(url)
      .then((r) => r.json() as Promise<FeatureCollection<Polygon | MultiPolygon, AreaProps>>)
      .then((fc) => fc.features as AreaFeature[])
      .catch(() => [])
  }
  return cache
}

/** Test helper — clears the module-level cache. */
export function resetAreasCache(): void {
  cache = null
}

export function getAreaGeometry(
  areas: AreaFeature[],
  id: string,
): Polygon | MultiPolygon | undefined {
  return areas.find((a) => a.properties.id === id)?.geometry
}

export function getArea(areas: AreaFeature[], id: string): AreaFeature | undefined {
  return areas.find((a) => a.properties.id === id)
}

/**
 * Builds grouped picker options:
 * - one group per Barcelona district, containing the district itself + its barris,
 * - one "Municipalities" group for metro-area municipalities.
 */
export function listAreaOptions(areas: AreaFeature[]): AreaOptionGroup[] {
  const districts = areas.filter((a) => a.properties.kind === 'district')
  const barris = areas.filter((a) => a.properties.kind === 'barri')
  const municipalities = areas.filter((a) => a.properties.kind === 'municipality')

  const groups: AreaOptionGroup[] = districts.map((d) => ({
    group: d.properties.name,
    items: [
      { value: d.properties.id, label: `${d.properties.name} (whole district)` },
      ...barris
        .filter((b) => b.properties.parent === d.properties.id)
        .map((b) => ({ value: b.properties.id, label: b.properties.name })),
    ],
  }))

  if (municipalities.length > 0) {
    groups.push({
      group: 'Metro municipalities',
      items: municipalities.map((m) => ({ value: m.properties.id, label: m.properties.name })),
    })
  }

  return groups
}
