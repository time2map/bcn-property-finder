import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render } from '@testing-library/react'
import { MapContext } from '../Map/MapContext'
import { PoiLayer } from './PoiLayer'
import { svgToImage } from './poiUtils'
import type maplibregl from 'maplibre-gl'

// Mock all ?raw SVG imports from maki
vi.mock('@mapbox/maki/icons/grocery.svg?raw',    { factory: () => ({ default: '<svg><path/></svg>' }) })
vi.mock('@mapbox/maki/icons/pharmacy.svg?raw',   { factory: () => ({ default: '<svg><path/></svg>' }) })
vi.mock('@mapbox/maki/icons/park.svg?raw',       { factory: () => ({ default: '<svg><path/></svg>' }) })
vi.mock('@mapbox/maki/icons/school.svg?raw',     { factory: () => ({ default: '<svg><path/></svg>' }) })
vi.mock('@mapbox/maki/icons/playground.svg?raw', { factory: () => ({ default: '<svg><path/></svg>' }) })
vi.mock('@mapbox/maki/icons/doctor.svg?raw',     { factory: () => ({ default: '<svg><path/></svg>' }) })
vi.mock('@mapbox/maki/icons/cafe.svg?raw',       { factory: () => ({ default: '<svg><path/></svg>' }) })
vi.mock('@mapbox/maki/icons/restaurant.svg?raw', { factory: () => ({ default: '<svg><path/></svg>' }) })
vi.mock('@mapbox/maki/icons/beach.svg?raw',      { factory: () => ({ default: '<svg><path/></svg>' }) })

// Stub Image so SVG loading resolves immediately
class StubImage {
  width = 0; height = 0
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_: string) { Promise.resolve().then(() => this.onload?.()) }
}
vi.stubGlobal('Image', StubImage)

function makeMockMap(overrides?: Partial<Record<string, ReturnType<typeof vi.fn>>>) {
  return {
    getSource:  vi.fn().mockReturnValue(null),
    addSource:  vi.fn(),
    addLayer:   vi.fn(),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    getLayer:   vi.fn().mockReturnValue(null),
    hasImage:   vi.fn().mockReturnValue(false),
    addImage:   vi.fn(),
    ...overrides,
  }
}

function renderWithMap(map: ReturnType<typeof makeMockMap> | null) {
  return render(
    <MapContext.Provider value={map as unknown as maplibregl.Map}>
      <PoiLayer />
    </MapContext.Provider>,
  )
}

describe('PoiLayer', () => {
  beforeEach(() => { vi.clearAllMocks() })
  afterEach(() => { vi.restoreAllMocks() })

  it('renders nothing to the DOM', () => {
    const { container } = renderWithMap(makeMockMap())
    expect(container.firstChild).toBeNull()
  })

  it('does nothing when map is null', () => {
    const map = makeMockMap()
    renderWithMap(null)
    expect(map.addSource).not.toHaveBeenCalled()
  })

  it('loads all 9 Maki icons into the map', async () => {
    const map = makeMockMap()
    renderWithMap(map)
    await vi.waitFor(() => expect(map.addImage).toHaveBeenCalledTimes(9))
    expect(map.addImage).toHaveBeenCalledWith('poi-grocery',    expect.any(StubImage), { pixelRatio: 2 })
    expect(map.addImage).toHaveBeenCalledWith('poi-pharmacy',   expect.any(StubImage), { pixelRatio: 2 })
    expect(map.addImage).toHaveBeenCalledWith('poi-restaurant', expect.any(StubImage), { pixelRatio: 2 })
  })

  it('adds PMTiles source and two layers', async () => {
    const map = makeMockMap()
    renderWithMap(map)
    await vi.waitFor(() => expect(map.addSource).toHaveBeenCalledTimes(1))

    expect(map.addSource).toHaveBeenCalledWith('poi-tiles', expect.objectContaining({
      type: 'vector',
      url: 'pmtiles:///barcelona_poi.pmtiles',
    }))
    expect(map.addLayer).toHaveBeenCalledTimes(2)
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({
      id: 'poi-priority',
      minzoom: 14,
    }))
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({
      id: 'poi-secondary',
      minzoom: 16,
    }))
  })

  it('skips setup if source already exists', async () => {
    const map = makeMockMap({ getSource: vi.fn().mockReturnValue({}) })
    renderWithMap(map)
    await vi.waitFor(() => expect(map.addImage).toHaveBeenCalled())
    expect(map.addSource).not.toHaveBeenCalled()
    expect(map.addLayer).not.toHaveBeenCalled()
  })

  it('skips addImage for icons already loaded', async () => {
    const map = makeMockMap({ hasImage: vi.fn().mockReturnValue(true) })
    renderWithMap(map)
    await vi.waitFor(() => expect(map.addSource).toHaveBeenCalled())
    expect(map.addImage).not.toHaveBeenCalled()
  })

  it('cleans up layers and source on unmount', async () => {
    const map = makeMockMap({
      getLayer:  vi.fn().mockReturnValue({}),
      getSource: vi.fn()
        .mockReturnValueOnce(null)  // first call inside setup (getSource check)
        .mockReturnValue({}),       // cleanup calls
    })
    const { unmount } = renderWithMap(map)
    await vi.waitFor(() => expect(map.addSource).toHaveBeenCalled())
    unmount()
    expect(map.removeLayer).toHaveBeenCalledWith('poi-secondary')
    expect(map.removeLayer).toHaveBeenCalledWith('poi-priority')
    expect(map.removeSource).toHaveBeenCalledWith('poi-tiles')
  })

  it('layers use correct source-layer name', async () => {
    const map = makeMockMap()
    renderWithMap(map)
    await vi.waitFor(() => expect(map.addLayer).toHaveBeenCalledTimes(2))
    const calls = map.addLayer.mock.calls.map((c: unknown[]) => c[0] as Record<string, unknown>)
    expect(calls[0]['source-layer']).toBe('poi')
    expect(calls[1]['source-layer']).toBe('poi')
  })
})

describe('svgToImage', () => {
  it('resolves with an HTMLImageElement on load', async () => {
    const img = await svgToImage('<svg><path/></svg>')
    expect(img).toBeInstanceOf(StubImage)
  })

  it('rejects when image fails to load', async () => {
    class FailImage {
      onload: (() => void) | null = null
      onerror: (() => void) | null = null
      set src(_: string) { Promise.resolve().then(() => this.onerror?.()) }
    }
    vi.stubGlobal('Image', FailImage)
    await expect(svgToImage('<bad/>')).rejects.toBeUndefined()
    vi.stubGlobal('Image', StubImage)
  })
})
