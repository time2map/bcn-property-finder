import { beforeAll, describe, expect, it } from 'vitest'
import { createCanvas, GlobalFonts, Path2D } from '@napi-rs/canvas'
import { drawShareImage, drawSiteImage, FORMAT_SIZE, mapSlot, type Ctx } from './shareImageDraw'
import { areaShareModel, buildingShareModel, type ShareModel } from './shareImageModel'
import { boundsOf, drawAreaMap, outerRings, projector } from './shareImageAreaMap'
import { areaFills, areaShapes, expand, renderBarriImage, renderSiteImage } from './shareImageRender'
import { PRESETS } from '../presets'
import type { AreaFeature } from '../areas'
import type { AreaRank } from '../areas/areaRank'

beforeAll(() => {
  ;(globalThis as { Path2D?: unknown }).Path2D = Path2D
  GlobalFonts.registerFromPath('node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff', 'IBM Plex Sans')
  GlobalFonts.registerFromPath('node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff', 'IBM Plex Sans')
})

const make = (w: number, h: number) => createCanvas(w, h) as unknown as { getContext(t: '2d'): Ctx }
const pixel = (canvas: ReturnType<typeof createCanvas>, x: number, y: number) =>
  Array.from(canvas.getContext('2d').getImageData(x, y, 1, 1).data)

const building: ShareModel = buildingShareModel({
  address: 'Carrer Tenerife 59', area: { name: 'Can Baró', kind: 'barri' }, score: 83, riskText: 'Risk: −13 points — street flooding',
  profile: { id: 'family', name: 'Family' },
  summary: {
    met: 1, total: 3, rows: [
      { id: 'noise', label: 'Quiet', status: 'met', text: '52 dB, under your 58' },
      { id: 'poiAccess', label: 'Everyday services', status: 'partly', text: '4 of 5 within 10 min' },
      { id: 'openPrice', label: 'Budget', status: 'missed', text: '€5,594/m², 57% over your €3,571' },
    ],
  },
})

const flatMap = (color: string) => (ctx: Ctx, slot: { width: number; height: number; focus: { x: number; y: number } }) => {
  ctx.fillStyle = color
  ctx.fillRect(0, 0, slot.width, slot.height)
  return slot.focus
}

describe('drawShareImage with rank lines (TODO-070)', () => {
  const ranked: ShareModel = {
    ...building,
    ranks: [
      { value: 'Top 10%', tier: 10, text: 'of homes in la Vila de Gràcia' },
      { value: 'Top 20%', tier: 20, text: 'of homes in Barcelona' },
    ],
    ranksHeading: 'For your conditions',
  }
  const draw = async (model: ShareModel, format: 'og' | 'post') => {
    const { width, height } = FORMAT_SIZE[format]
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d') as unknown as Ctx
    const texts: string[] = []
    const fill = ctx.fillText.bind(ctx)
    ctx.fillText = (t: string, ...rest: [number, number]) => { texts.push(t); fill(t, ...rest) }
    await drawShareImage(ctx, model, { format, attribution: 'x', domain: 'd', drawMap: flatMap('#336699') })
    return { canvas, texts }
  }

  it.each(['og', 'post'] as const)('writes both tiles and the heading on the %s picture', async (format) => {
    const { texts } = await draw(ranked, format)
    expect(texts).toContain('FOR YOUR CONDITIONS')
    expect(texts).toContain('Top 10%')
    expect(texts).toContain('Top 20%')
    expect(texts.join(' ')).toMatch(/in la Vila de Gràcia/)
    expect(texts.join(' ')).toMatch(/in Barcelona/)
  })

  it('leaves the heading out when a profile says for whom', async () => {
    const { texts } = await draw({ ...ranked, ranksHeading: null }, 'post')
    expect(texts).not.toContain('FOR YOUR CONDITIONS')
    expect(texts.join(' ')).toMatch(/in Barcelona/)
  })

  it('draws one tile across the width, the number beside the text', async () => {
    const { texts } = await draw({ ...ranked, ranks: ranked.ranks.slice(1) }, 'og')
    expect(texts).toContain('Top 20%')
    expect(texts).not.toContain('Top 10%')
    expect(texts.join(' ')).toMatch(/in Barcelona/)
  })

  it('keeps both tiles on the small preview and drops condition rows that do not fit, the risk row last', async () => {
    const crowded = {
      ...ranked,
      place: 'Carrer Ferlandina 22, a long address',
      rows: [
        { status: 'partly' as const, text: 'Noise: 59 dB, 1 over your 58' },
        { status: 'met' as const, text: 'Services: 5 of 5 within 10 min' },
        { status: 'risk' as const, text: 'Risk: −6 points — street flooding' },
      ],
    }
    const { texts } = await draw(crowded, 'og')
    expect(texts).toContain('Top 10%')
    expect(texts).toContain('Top 20%')
    const all = texts.join(' ')
    expect(all).not.toMatch(/Services: 5 of 5/)
    if (/Noise: 59/.test(all)) expect(all).toMatch(/Risk: −6/)
  })

  it('still fits with long lines and four rows by shrinking the text', async () => {
    const long = {
      ...ranked,
      ranks: ranked.ranks.map((r) => ({ ...r, text: `${r.text} And then some words that make the text wrap onto more rows` })),
      rows: Array.from({ length: 4 }, () => ({ status: 'partly' as const, text: 'Everyday services: 4 of 5 within 10 min on foot, and a bit more' })),
    }
    const { canvas } = await draw(long, 'og')
    expect(canvas.toBuffer('image/png').length).toBeGreaterThan(5000)
  })
})

describe('drawShareImage', () => {
  it.each(['og', 'post'] as const)('paints a %s picture of the right size', async (format) => {
    const { width, height } = FORMAT_SIZE[format]
    const canvas = createCanvas(width, height)
    await drawShareImage(canvas.getContext('2d') as unknown as Ctx, building, {
      format, attribution: 'Map: test', domain: 'livability.time2map.com', drawMap: flatMap('#336699'),
    })
    expect(canvas.width).toBe(width)
    expect(canvas.height).toBe(height)
    expect(canvas.toBuffer('image/png').length).toBeGreaterThan(5000)
  })

  it('puts the map on the left and a white panel on the right of the preview', async () => {
    const canvas = createCanvas(1200, 630)
    await drawShareImage(canvas.getContext('2d') as unknown as Ctx, building, {
      format: 'og', attribution: 'x', domain: 'd', drawMap: flatMap('#336699'),
    })
    expect(pixel(canvas, 40, 300)).toEqual([0x33, 0x66, 0x99, 255])
    expect(pixel(canvas, 1150, 300)).toEqual([255, 255, 255, 255])
  })

  it('stacks the 4:5 picture on white: brand line, the map in a rounded rectangle, then the result', async () => {
    const canvas = createCanvas(1080, 1350)
    await drawShareImage(canvas.getContext('2d') as unknown as Ctx, building, {
      format: 'post', attribution: 'x', domain: 'd', drawMap: flatMap('#336699'),
    })
    expect(pixel(canvas, 300, 300)).toEqual([0x33, 0x66, 0x99, 255]) // inside the map
    expect(pixel(canvas, 10, 360)).toEqual([255, 255, 255, 255]) // white margin beside it
    expect(pixel(canvas, 1070, 40)).toEqual([255, 255, 255, 255]) // brand strip above it
    expect(pixel(canvas, 38, 114)).toEqual([255, 255, 255, 255]) // the corner is rounded
    expect(pixel(canvas, 1040, 1330)).toEqual([255, 255, 255, 255])
  })

  it('has the brand line above the map, not among the rows', async () => {
    const canvas = createCanvas(1080, 1350)
    const ctx = canvas.getContext('2d') as unknown as Ctx
    const drawn: { t: string; y: number }[] = []
    const fill = ctx.fillText.bind(ctx)
    ctx.fillText = (t: string, x: number, y: number) => { drawn.push({ t, y }); fill(t, x, y) }
    await drawShareImage(ctx, building, { format: 'post', attribution: 'x', domain: 'livability.time2map.com', drawMap: flatMap('#336699') })
    const brand = drawn.find((d) => d.t === 'Barcelona livability map')!
    const domain = drawn.find((d) => d.t === 'livability.time2map.com')!
    expect(brand.y).toBeLessThan(112)
    expect(domain.y).toBeLessThan(112)
    expect(drawn.find((d) => d.t === 'Quiet: 52 dB, under your 58')!.y).toBeGreaterThan(612)
  })

  it('colours the plaque with the band of the score', async () => {
    const canvas = createCanvas(1200, 630)
    await drawShareImage(canvas.getContext('2d') as unknown as Ctx, building, {
      format: 'og', attribution: 'x', domain: 'd', drawMap: flatMap('#336699'),
    })
    // The plaque is Good (#91cf60); a point inside it, to the right of the text.
    const plaque = Array.from({ length: 12 }, (_, i) => pixel(canvas, 1110, 215 + i * 10))
    expect(plaque.some(([r, g, b]) => r === 0x91 && g === 0xcf && b === 0x60)).toBe(true)
  })

  it('still draws when the map cannot be read, and with no rows, no profile and a long place', async () => {
    const bare = { ...building, forWhom: null, subtitle: null, rows: [], place: 'Carrer de Sant Pere Més Alt amb Plaça de Lesseps' }
    const canvas = createCanvas(1200, 630)
    await drawShareImage(canvas.getContext('2d') as unknown as Ctx, bare, {
      format: 'og', attribution: 'x', domain: 'd', drawMap: () => null,
    })
    expect(canvas.toBuffer('image/png').length).toBeGreaterThan(3000)
  })

  it('shrinks the rows rather than overflowing when they are long', async () => {
    const long = { ...building, rows: Array.from({ length: 4 }, () => ({ status: 'partly' as const, text: 'Everyday services: 4 of 5 within 10 min on foot, and a bit more' })) }
    const canvas = createCanvas(1200, 630)
    await drawShareImage(canvas.getContext('2d') as unknown as Ctx, long, {
      format: 'og', attribution: 'x', domain: 'd', drawMap: flatMap('#336699'),
    })
    expect(canvas.toBuffer('image/png').length).toBeGreaterThan(3000)
  })

  it('draws an area picture with a caption', async () => {
    const area = areaShareModel({
      rank: { name: 'Gràcia', kind: 'barri', shareGood: 62, mean: 70, strongest: ['noise'] }, profile: null,
    })
    const canvas = createCanvas(1200, 630)
    await drawShareImage(canvas.getContext('2d') as unknown as Ctx, area, {
      format: 'og', attribution: 'x', domain: 'd', drawMap: flatMap('#336699'),
    })
    expect(canvas.toBuffer('image/png').length).toBeGreaterThan(3000)
  })
})

describe('mapSlot', () => {
  it('centres on the free part beside the panel, or above it', () => {
    expect(mapSlot('og').focus).toEqual({ x: 328, y: 315 })
    expect(mapSlot('post').focus).toEqual({ x: 504, y: 250 })
  })
})

describe('drawSiteImage', () => {
  it('paints the question and the four bands', async () => {
    const canvas = createCanvas(1200, 630)
    await drawSiteImage(canvas.getContext('2d') as unknown as Ctx, {
      attribution: 'x', domain: 'd', headline: 'How liveable is your street?', sentence: 'A sentence.', drawMap: () => null,
    })
    expect(canvas.toBuffer('image/png').length).toBeGreaterThan(3000)
  })
})

// ---- the map of the build-time pictures ----

const square = (id: string, kind: AreaFeature['properties']['kind'], x: number, y: number): AreaFeature => ({
  type: 'Feature', properties: { id, name: id, kind },
  geometry: { type: 'Polygon', coordinates: [[[x, y], [x + 0.01, y], [x + 0.01, y + 0.01], [x, y + 0.01], [x, y]]] },
})
const features = [square('d1', 'district', 2.1, 41.3), square('b1', 'barri', 2.1, 41.3), square('b2', 'barri', 2.12, 41.3), square('m1', 'municipality', 2.2, 41.3)]

describe('area map', () => {
  it('takes the outer rings of polygons and multipolygons', () => {
    expect(outerRings({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]], [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.1]]] })).toHaveLength(1)
    expect(outerRings({ type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]], [[[2, 2], [3, 2], [3, 3], [2, 2]]]] })).toHaveLength(2)
    expect(outerRings({ type: 'Point', coordinates: [0, 0] })).toEqual([])
  })

  it('finds the bounds and fits them into a box, north up', () => {
    const b = boundsOf([[[2, 41], [3, 41], [3, 42]]])
    expect(b).toEqual({ west: 2, south: 41, east: 3, north: 42 })
    const { point } = projector({ west: 2, south: 41, east: 3, north: 42 }, { x: 0, y: 0, w: 100, h: 100 })
    const [, yNorth] = point(2.5, 42)
    const [, ySouth] = point(2.5, 41)
    expect(yNorth).toBeLessThan(ySouth)
  })

  it('leaves districts out and fills areas by their rank', () => {
    const shapes = areaShapes(features)
    expect(shapes.map((s) => s.id)).toEqual(['b1', 'b2', 'm1'])
    const rank = (index: number, mean: number, ranked = true): AreaRank => ({
      index, code: String(index), name: 'x', kind: 'barri', n: 100, mean, shareGood: 50, shareGreat: 10, gapShare: 0,
      incomplete: false, strongest: [], ranked,
    })
    const join = new Map([[0, features[1]], [1, features[2]], [2, features[3]]])
    const fill = areaFills([rank(0, 100), rank(1, 0), rank(2, 50, false)], join)
    expect(fill('b1')).toBe('#1a9850')
    expect(fill('b2')).toBe('#d73027')
    expect(fill('m1')).toBe('#d9dcd6')
    expect(fill('nothing')).toBe('#d9dcd6')
  })

  it('grows bounds around their centre', () => {
    expect(expand({ west: 0, south: 0, east: 2, north: 4 }, 2)).toEqual({ west: -1, east: 3, south: -2, north: 6 })
  })

  it('returns where the focus area is, and null without one', () => {
    const canvas = createCanvas(1200, 630)
    const ctx = canvas.getContext('2d') as unknown as Ctx
    const shapes = areaShapes(features)
    const view = boundsOf(shapes.flatMap((s) => s.polygons))
    const opts = { share: 0.9, freeWidth: 620, freeHeight: 630 }
    const at = drawAreaMap(ctx, mapSlot('og'), shapes, () => '#ff0000', view, { ...opts, focusId: 'b1' })
    expect(at).not.toBeNull()
    expect(at!.x).toBeLessThan(328)
    expect(drawAreaMap(ctx, mapSlot('og'), shapes, () => '#ff0000', view, opts)).toBeNull()
  })
})

describe('build-time pictures', () => {
  const family = PRESETS[0]
  const rank: AreaRank = {
    index: 0, code: '1', name: 'Barri Un', kind: 'barri', n: 200, mean: 70, shareGood: 55, shareGreat: 10, gapShare: 0,
    incomplete: false, strongest: ['noise', 'poiAccess'], ranked: true,
  }
  const shapes = areaShapes(features)

  it('makes the picture of a barri in both formats', async () => {
    for (const format of ['og', 'post'] as const) {
      const canvas = await renderBarriImage(make, {
        page: { profile: family, rank, path: 'family/barri-un' }, shapes, fill: () => '#91cf60', areaId: 'b1', format,
      }, 'https://livability.time2map.com')
      expect((canvas as unknown as { width: number }).width).toBe(FORMAT_SIZE[format].width)
    }
  })

  it('makes the picture of the home page', async () => {
    const canvas = await renderSiteImage(make, shapes, () => '#91cf60', new Set(['b1', 'b2']), 'https://livability.time2map.com')
    expect((canvas as unknown as { height: number }).height).toBe(630)
  })
})
