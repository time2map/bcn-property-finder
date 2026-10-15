import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import type * as maplibregl from 'maplibre-gl'
import { gridDisk, latLngToCell } from 'h3-js'
import { MapContext } from '../Map/MapContext'
import { BestZones } from './BestZones'
import { useStore } from '../../store'
import { useIdealistaBaseUrlStore } from '../../store/idealistaBaseUrlStore'

const { popup } = vi.hoisted(() => ({
  popup: {
    setLngLat: vi.fn().mockReturnThis(),
    setDOMContent: vi.fn().mockReturnThis(),
    addTo: vi.fn().mockReturnThis(),
    remove: vi.fn(),
  },
}))
vi.mock('maplibre-gl', () => ({ Popup: vi.fn(function () { return popup }) }))

// One 7-cell hot spot (score 90) on a zero-score grid; computeComposite returns `walk` as score.
const HOT = new Set(gridDisk(latLngToCell(41.39, 2.17, 9), 1))
const BUNDLES = gridDisk(latLngToCell(41.39, 2.17, 9), 10).map((h3) => ({ h3, walk: HOT.has(h3) ? 90 : 0 }))
vi.mock('../../services/composite/compositeData', () => ({
  loadBundles: vi.fn(() => Promise.resolve(BUNDLES)),
  loadOpenPriceMeta: vi.fn().mockResolvedValue({ p5: 2000, p95: 6000 }),
}))
vi.mock('../../services/composite/compositeScore', () => ({
  computeComposite: (b: { walk: number }) => ({ score: b.walk }),
}))

type Handler = (e: unknown) => void

const rect = (left: number, top: number, right: number, bottom: number) =>
  ({ left, top, right, bottom, width: right - left, height: bottom - top }) as DOMRect

/** A DOM overlay (side panel / card) covering part of the map. */
function overlay(className: string, r: DOMRect) {
  const el = document.createElement('div')
  el.className = className
  el.getBoundingClientRect = () => r
  document.body.appendChild(el)
  return el
}

function makeMap() {
  const sources: Record<string, { setData: ReturnType<typeof vi.fn> }> = {}
  const handlers: Record<string, Handler> = {}
  return {
    sources,
    handlers,
    // Current camera: a 1000×500 px container showing `view` = [west, south, east, north].
    view: [2.0, 41.2, 2.4, 41.6],
    getContainer: () => ({ getBoundingClientRect: () => rect(0, 0, 1000, 500) }),
    unproject([x, y]: [number, number]) {
      const [w, s, e, n] = this.view
      return { lng: w + ((e - w) * x) / 1000, lat: n - ((n - s) * y) / 500 }
    },
    addSource: vi.fn((id: string) => { sources[id] = { setData: vi.fn() } }),
    getSource: vi.fn((id: string) => sources[id]),
    addLayer: vi.fn(),
    getLayer: vi.fn(() => undefined),
    removeLayer: vi.fn(),
    removeSource: vi.fn(),
    setFeatureState: vi.fn(),
    // map.on(event, fn) or map.on(event, layerId, fn)
    on: vi.fn((ev: string, a: string | Handler, b?: Handler) => {
      if (typeof a === 'function') handlers[ev] = a
      else handlers[`${ev}:${a}`] = b!
    }),
    off: vi.fn(),
    getCanvas: () => ({ style: {} }),
  }
}

let map: ReturnType<typeof makeMap>

function renderBar() {
  return render(
    <MantineProvider>
      <MapContext.Provider value={map as unknown as maplibregl.Map}>
        <BestZones />
      </MapContext.Provider>
    </MantineProvider>,
  )
}

const lastData = () => map.sources['best-zones'].setData.mock.calls.at(-1)![0] as GeoJSON.FeatureCollection

describe('BestZones', () => {
  beforeEach(() => {
    map = makeMap()
    popup.setDOMContent.mockClear()
    useStore.setState({ compositeVisible: true, bestZonesBounds: null, bestZonesTopPct: 3, compositeScoreRange: [0, 100] })
    useIdealistaBaseUrlStore.setState({ baseUrl: null })
  })

  it('is hidden while the Livability Index is off', () => {
    useStore.setState({ compositeVisible: false })
    renderBar()
    expect(screen.queryByRole('button', { name: /draw best zones/i })).toBeNull()
  })

  it('happy path: draw → zone on the map → click → popup with an Idealista link', async () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: /draw best zones/i }))
    expect(useStore.getState().bestZonesBounds).toEqual([2.0, 41.2, 2.4, 41.6])

    await waitFor(() => expect(lastData().features.length).toBeGreaterThan(0))
    expect(lastData().features[0].properties).toMatchObject({ label: '1' })

    act(() => map.handlers['click:best-zones-fill']({ features: [{ id: 0 }], lngLat: { lng: 2.17, lat: 41.39 } }))
    const link = popup.setDOMContent.mock.calls.at(-1)![0] as HTMLAnchorElement
    expect(link.textContent).toBe('Open zone 1 in Idealista ↗')
    expect(link.href).toMatch(/idealista\.com\/.*\?shape=%28%28/)
    expect(link.target).toBe('_blank')

    // The popup shows the zone's stable number (its label), not its position in the list.
    act(() => map.handlers['click:best-zones-fill']({ features: [{ id: 0, properties: { label: '4' } }], lngLat: { lng: 2.17, lat: 41.39 } }))
    expect((popup.setDOMContent.mock.calls.at(-1)![0] as HTMLAnchorElement).textContent).toBe('Open zone 4 in Idealista ↗')
  })

  it('ignores the map area hidden under the left panel and the right hex card', () => {
    const panel = overlay('top-panel', rect(12, 12, 300, 480))
    const card = overlay('hex-detail-overlay', rect(800, 16, 980, 300))
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: /draw best zones/i }))
    const [w, s, e, n] = useStore.getState().bestZonesBounds!
    expect(w).toBeCloseTo(2.12) // 300 px of 1000 → 30% of 0.4°
    expect(e).toBeCloseTo(2.32) // 800 px
    expect([s, n]).toEqual([41.2, 41.6])
    panel.remove()
    card.remove()
  })

  it('one button toggles: Draw best zones ↔ Clear zones; Esc clears too', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: 'Draw best zones' }))
    expect(useStore.getState().bestZonesBounds).not.toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Clear zones' }))
    expect(useStore.getState().bestZonesBounds).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Draw best zones' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useStore.getState().bestZonesBounds).toBeNull()
    expect(screen.getByRole('button', { name: 'Draw best zones' })).toBeInTheDocument()
  })

  it('zones follow the map: panning/zooming redraws them for the new view', () => {
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: 'Draw best zones' }))
    map.view = [2.1, 41.3, 2.3, 41.5]
    act(() => map.handlers.moveend({}))
    expect(useStore.getState().bestZonesBounds).toEqual([2.1, 41.3, 2.3, 41.5])
  })

  it('panning does not bring cleared zones back', () => {
    renderBar()
    act(() => map.handlers.moveend({}))
    expect(useStore.getState().bestZonesBounds).toBeNull()
  })

  it('strictness slider: right = stricter (smaller top %)', () => {
    useStore.setState({ bestZonesTopPct: 15 })
    renderBar()
    expect(screen.getByText('top 15%')).toBeInTheDocument()
    const thumb = screen.getByRole('slider', { name: /strictness/i })
    fireEvent.keyDown(thumb, { key: 'ArrowRight' })
    expect(useStore.getState().bestZonesTopPct).toBe(10)
  })

  it('says so when nothing qualifies', async () => {
    useStore.setState({ compositeScoreRange: [95, 100] })
    renderBar()
    fireEvent.click(screen.getByRole('button', { name: /draw best zones/i }))
    expect(await screen.findByText('No zones fit this view — zoom out')).toBeInTheDocument()
  })

  it('highlights the hovered zone', () => {
    renderBar()
    act(() => map.handlers['mousemove:best-zones-fill']({ features: [{ id: 0 }] }))
    expect(map.setFeatureState).toHaveBeenLastCalledWith({ source: 'best-zones', id: 0 }, { hover: true })
    act(() => map.handlers['mouseleave:best-zones-fill']({}))
    expect(map.setFeatureState).toHaveBeenLastCalledWith({ source: 'best-zones', id: 0 }, { hover: false })
  })

  it('removes its map layers on unmount', () => {
    const { unmount } = renderBar()
    map.getLayer.mockReturnValue({} as never)
    unmount()
    expect(map.removeSource).toHaveBeenCalledWith('best-zones')
  })
})
