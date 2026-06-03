import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, act } from '@testing-library/react'
import type maplibregl from 'maplibre-gl'

// ── Mock terra-draw + adapter ────────────────────────────────────────────────
interface MockInstance {
  enabled: boolean
  handlers: Record<string, (...args: unknown[]) => void>
  snapshot: unknown[]
  start: ReturnType<typeof vi.fn>
  stop: ReturnType<typeof vi.fn>
  setMode: ReturnType<typeof vi.fn>
  clear: ReturnType<typeof vi.fn>
  getSnapshot: ReturnType<typeof vi.fn>
  on: ReturnType<typeof vi.fn>
  off: ReturnType<typeof vi.fn>
}

const instances: MockInstance[] = []

vi.mock('terra-draw', () => {
  class TerraDraw {
    enabled = false
    handlers: Record<string, (...args: unknown[]) => void> = {}
    snapshot: unknown[] = []
    start = vi.fn(() => {
      this.enabled = true
    })
    stop = vi.fn(() => {
      this.enabled = false
    })
    setMode = vi.fn()
    clear = vi.fn()
    getSnapshot = vi.fn(() => this.snapshot)
    on = vi.fn((ev: string, cb: (...args: unknown[]) => void) => {
      this.handlers[ev] = cb
    })
    off = vi.fn()
    constructor() {
      instances.push(this as unknown as MockInstance)
    }
  }
  return {
    TerraDraw,
    TerraDrawPolygonMode: class {},
    TerraDrawFreehandMode: class {},
  }
})

vi.mock('terra-draw-maplibre-gl-adapter', () => ({
  TerraDrawMapLibreGLAdapter: class {},
}))

import { ExclusionDraw } from './ExclusionDraw'
import { MapContext } from '../Map/MapContext'
import { useExclusionsStore } from '../../store/exclusionsStore'

const mockMap = {} as unknown as maplibregl.Map

function renderDraw() {
  return render(
    <MapContext.Provider value={mockMap}>
      <ExclusionDraw />
    </MapContext.Provider>,
  )
}

describe('ExclusionDraw', () => {
  beforeEach(() => {
    instances.length = 0
    localStorage.clear()
    useExclusionsStore.setState({ zones: [], drawingMode: null })
  })

  it('creates a TerraDraw instance and registers a finish handler', () => {
    renderDraw()
    expect(instances).toHaveLength(1)
    expect(instances[0].on).toHaveBeenCalledWith('finish', expect.any(Function))
  })

  it('starts and sets the mode when drawingMode becomes set', () => {
    renderDraw()
    act(() => useExclusionsStore.setState({ drawingMode: 'polygon' }))
    expect(instances[0].start).toHaveBeenCalled()
    expect(instances[0].setMode).toHaveBeenCalledWith('polygon')
  })

  it('adds a zone and exits drawing mode when a polygon is finished', () => {
    renderDraw()
    act(() => useExclusionsStore.setState({ drawingMode: 'polygon' }))

    instances[0].snapshot = [
      {
        id: 'abc',
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      },
    ]
    act(() => instances[0].handlers.finish('abc'))

    const { zones, drawingMode } = useExclusionsStore.getState()
    expect(zones).toHaveLength(1)
    expect(zones[0].source).toBe('drawn')
    expect(drawingMode).toBeNull()
    expect(instances[0].clear).toHaveBeenCalled()
  })
})
