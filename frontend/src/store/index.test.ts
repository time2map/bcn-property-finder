import { describe, it, expect, beforeEach } from 'vitest'
import { readUrlParams, useStore } from './index'

function setSearch(search: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    configurable: true,
  })
}

describe('readUrlParams', () => {
  it('returns defaults when URL is empty', () => {
    setSearch('')
    expect(readUrlParams()).toEqual({ workplace: null, mode: 'foot-walking', minutes: 30 })
  })

  it('reads workplace from lng/lat', () => {
    setSearch('?lng=2.1734&lat=41.3851')
    expect(readUrlParams().workplace).toEqual([2.1734, 41.3851])
  })

  it('reads valid mode', () => {
    setSearch('?mode=cycling-regular')
    expect(readUrlParams().mode).toBe('cycling-regular')
  })

  it('reads valid minutes', () => {
    setSearch('?minutes=20')
    expect(readUrlParams().minutes).toBe(20)
  })

  it('falls back to default for unknown mode', () => {
    setSearch('?mode=teleportation')
    expect(readUrlParams().mode).toBe('foot-walking')
  })

  it('falls back to default for out-of-range minutes', () => {
    setSearch('?minutes=99')
    expect(readUrlParams().minutes).toBe(30)
  })

  it('ignores NaN coordinates', () => {
    setSearch('?lng=abc&lat=def')
    expect(readUrlParams().workplace).toBeNull()
  })

  it('ignores lone lat without lng', () => {
    setSearch('?lat=41.38')
    expect(readUrlParams().workplace).toBeNull()
  })

  it('reads all params together', () => {
    setSearch('?lng=2.17&lat=41.38&mode=driving-car&minutes=45')
    expect(readUrlParams()).toEqual({
      workplace: [2.17, 41.38],
      mode: 'driving-car',
      minutes: 45,
    })
  })
})

describe('store setters', () => {
  beforeEach(() => {
    useStore.setState({ workplace: null, mode: 'foot-walking', minutes: 30, resultPolygon: null })
  })

  it('setWorkplace updates workplace', () => {
    useStore.getState().setWorkplace([2.17, 41.38])
    expect(useStore.getState().workplace).toEqual([2.17, 41.38])
  })

  it('setWorkplace accepts null', () => {
    useStore.getState().setWorkplace([2.17, 41.38])
    useStore.getState().setWorkplace(null)
    expect(useStore.getState().workplace).toBeNull()
  })

  it('setMode updates mode', () => {
    useStore.getState().setMode('driving-car')
    expect(useStore.getState().mode).toBe('driving-car')
  })

  it('setMinutes updates minutes', () => {
    useStore.getState().setMinutes(45)
    expect(useStore.getState().minutes).toBe(45)
  })

  it('setResultPolygon updates resultPolygon', () => {
    const polygon = { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }
    useStore.getState().setResultPolygon(polygon)
    expect(useStore.getState().resultPolygon).toEqual(polygon)
  })
})
