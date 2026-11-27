import type { AreaFeature } from '../areas'
import type { AreaRank } from '../areas/areaRank'
import { scoreColorForRange } from '../../components/BuildingCard/cardColors'
import { AREA_ATTRIBUTION, siteLabel } from './shareConfig'
import { drawShareImage, drawSiteImage, FORMAT_SIZE, type Ctx, type MapSlot } from './shareImageDraw'
import { boundsOf, drawAreaMap, outerRings, type AreaShape, type Bounds } from './shareImageAreaMap'
import { areaShareModel } from './shareImageModel'
import type { SharePage } from './shareImageBuild'

// The pictures made at build time (TODO-063), on a canvas the caller creates (@napi-rs/canvas in the build script).

/** The barris and the towns around them as flat shapes; districts are left out (they only overlap the barris). */
export function areaShapes(features: readonly AreaFeature[]): AreaShape[] {
  return features
    .filter((f) => f.properties.kind !== 'district')
    .map((f) => ({ id: f.properties.id, polygons: outerRings(f.geometry) }))
}

/** Colour of every area by its mean score, on the map's own scale; areas with no rank stay light grey. */
export function areaFills(
  ranks: readonly AreaRank[], join: ReadonlyMap<number, AreaFeature>,
): (id: string) => string {
  const byId = new Map<string, string>()
  for (const r of ranks) {
    const f = join.get(r.index)
    if (f && r.ranked) byId.set(f.properties.id, scoreColorForRange(r.mean, 0, 100))
  }
  return (id) => byId.get(id) ?? '#d9dcd6'
}

/** `b` grown by `factor` around its centre. */
export function expand(b: Bounds, factor: number): Bounds {
  const cx = (b.west + b.east) / 2
  const cy = (b.south + b.north) / 2
  const hx = ((b.east - b.west) / 2) * factor
  const hy = ((b.north - b.south) / 2) * factor
  return { west: cx - hx, east: cx + hx, south: cy - hy, north: cy + hy }
}

/** The part of the picture the panel leaves free. */
const FREE = { og: { w: 620, h: 630 }, post: { w: 1008, h: 500 } } as const

/** A canvas of the size of `format`, from the caller's factory. */
type MakeCanvas = (width: number, height: number) => { getContext(type: '2d'): Ctx }

export interface BarriImageInput {
  page: SharePage
  shapes: readonly AreaShape[]
  fill: (id: string) => string
  /** `properties.id` of the barri's polygon. */
  areaId: string
  format?: 'og' | 'post'
}

/** The picture of a barri for a profile. Returns the canvas the caller encodes. */
export async function renderBarriImage(make: MakeCanvas, input: BarriImageInput, siteUrl: string) {
  const format = input.format ?? 'og'
  const { width, height } = FORMAT_SIZE[format]
  const canvas = make(width, height)
  const ctx = canvas.getContext('2d')
  const focus = input.shapes.find((s) => s.id === input.areaId)
  const view = expand(boundsOf(focus?.polygons ?? input.shapes.flatMap((s) => s.polygons)), 2.4)
  const model = areaShareModel({ rank: input.page.rank, profile: input.page.profile })
  await drawShareImage(ctx, model, {
    format,
    attribution: AREA_ATTRIBUTION,
    domain: siteLabel(siteUrl),
    drawMap: (c: Ctx, slot: MapSlot) =>
      drawAreaMap(c, slot, input.shapes, input.fill, view, {
        focusId: input.areaId, share: 0.9, freeWidth: FREE[format].w, freeHeight: FREE[format].h,
      }),
  })
  return canvas
}

/** The link preview of the home page: the whole city coloured by the first-visit settings. */
export async function renderSiteImage(
  make: MakeCanvas, shapes: readonly AreaShape[], fill: (id: string) => string, barriIds: ReadonlySet<string>, siteUrl: string,
) {
  const { width, height } = FORMAT_SIZE.og
  const canvas = make(width, height)
  const ctx = canvas.getContext('2d')
  const city = boundsOf(shapes.filter((s) => barriIds.has(s.id)).flatMap((s) => s.polygons))
  await drawSiteImage(ctx, {
    attribution: AREA_ATTRIBUTION,
    domain: siteLabel(siteUrl),
    headline: 'How liveable is your street?',
    sentence: 'Noise, daily services, prices and risks for every building in Barcelona, scored against your own conditions.',
    drawMap: (c: Ctx, slot: MapSlot) => {
      drawAreaMap(c, slot, shapes, fill, city, { share: 0.94, freeWidth: FREE.og.w, freeHeight: FREE.og.h })
      return null
    },
  })
  return canvas
}
