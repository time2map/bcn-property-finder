/**
 * Card data of one building (TODO-046): buildings-detail.pmtiles holds, at z14 only, a point per building with
 * the card fields (layer `d`) and the facade noise points of stage 2 (layer `f`). One tile per click.
 */
import { PMTiles } from 'pmtiles'
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import { lngLatToTile } from '../noise/noiseData'
import { dataUrl } from '../dataUrl'

const DETAIL_ZOOM = 14
const CACHE_SIZE = 50

/** Card fields; a field is absent when Catastro or the models have no value. */
export interface BuildingDetail {
  i: number
  /** Cadastral reference (14 chars). */
  id: string
  address?: string
  use?: string
  dwellings?: number
  units?: number
  floors?: number
  floors_below?: number
  year_built?: number
  year_renov?: number
  area_m2?: number
  condition?: string
  /** 1 = student residence (OSM dormitory / student accommodation). */
  student?: number
  noise_src?: 'bcn_raster_2022' | 'sica_2022'
  lden_avg?: number
  ln_avg?: number
  lden_street?: number
  ln_street?: number
  lden_inner?: number
  ln_inner?: number
  lden_max?: number
  ln_max?: number
  lden_min?: number
  ln_min?: number
  f17_lden_max?: number
  f17_ln_max?: number
  f17_leisure_ln_max?: number
  river_zone?: number
  street_t10_cm?: number
  street_t100_cm?: number
  fire_wui?: number
  fire_class?: number
  fire_dist_m?: number
  /** Walking minutes to the nearest service of each category: min_<category>. */
  [minutes: `min_${string}`]: number | undefined
}

/** A facade group (building × side × direction) with its measurement point. */
export interface FacadeNoise {
  lng: number
  lat: number
  side: 'street' | 'inner'
  dir: string
  length_m: number
  lden: number
  ln?: number
}

export interface BuildingDetailResult {
  detail: BuildingDetail | null
  facades: FacadeNoise[]
}

interface TileLayer {
  length: number
  feature(k: number): {
    properties: Record<string, unknown>
    toGeoJSON(x: number, y: number, z: number): GeoJSON.Feature
  }
}

/** The building's card fields and facade points from a decoded detail tile. */
export function readDetail(layers: Record<string, TileLayer | undefined>, x: number, y: number, i: number): BuildingDetailResult {
  let detail: BuildingDetail | null = null
  const d = layers.d
  for (let k = 0; d && k < d.length; k++) {
    const props = d.feature(k).properties
    if (props.i === i) { detail = props as unknown as BuildingDetail; break }
  }
  const facades: FacadeNoise[] = []
  const f = layers.f
  for (let k = 0; f && k < f.length; k++) {
    const feat = f.feature(k)
    if (feat.properties.i !== i) continue
    const [lng, lat] = (feat.toGeoJSON(x, y, DETAIL_ZOOM).geometry as GeoJSON.Point).coordinates
    facades.push({ ...(feat.properties as unknown as Omit<FacadeNoise, 'lng' | 'lat'>), lng, lat })
  }
  return { detail, facades }
}

let pmtiles: PMTiles | null = null
const cache = new Map<number, Promise<BuildingDetailResult>>()

/** Card data of building i, whose centroid is (lng, lat). Recent results are cached. */
export function loadBuildingDetail(i: number, lng: number, lat: number): Promise<BuildingDetailResult> {
  const hit = cache.get(i)
  if (hit) return hit
  pmtiles ??= new PMTiles(dataUrl('buildings-detail.pmtiles'))
  const { x, y } = lngLatToTile(lng, lat, DETAIL_ZOOM)
  const p = pmtiles.getZxy(DETAIL_ZOOM, x, y)
    .then((tile) => (tile ? readDetail(new VectorTile(new Pbf(tile.data)).layers, x, y, i) : { detail: null, facades: [] }))
    .catch((err) => {
      cache.delete(i)
      throw err
    })
  cache.set(i, p)
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value!)
  return p
}
