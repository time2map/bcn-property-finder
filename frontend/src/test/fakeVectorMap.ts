import { vi } from 'vitest'

/** Minimal MapLibre stand-in for vector-tile layer components (sources, layers, layout calls). */
export function makeFakeVectorMap() {
  const sources = new Map<string, unknown>()
  const layers = new Map<string, unknown>()
  return {
    getSource: (id: string) => sources.get(id),
    addSource: (id: string, src: unknown) => { sources.set(id, src) },
    getLayer: (id: string) => layers.get(id),
    addLayer: (l: { id: string }) => { layers.set(l.id, l) },
    setLayoutProperty: vi.fn(),
    removeLayer: vi.fn((id: string) => { layers.delete(id) }),
    removeSource: vi.fn((id: string) => { sources.delete(id) }),
  }
}

export type FakeVectorMap = ReturnType<typeof makeFakeVectorMap>
