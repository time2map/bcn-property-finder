import { describe, it, expect, beforeEach } from 'vitest'
import { readUrlParams, useStore } from './index'

function setSearch(search: string) {
  Object.defineProperty(window, 'location', {
    value: { ...window.location, search },
    configurable: true,
  })
}

const DEFAULT_WORKPLACE: [number, number] = [2.1687, 41.3874]

describe('readUrlParams', () => {
  it('returns defaults when URL is empty', () => {
    setSearch('')
    expect(readUrlParams()).toEqual({
      workplace: DEFAULT_WORKPLACE,
      mode: 'foot',
      minutes: 60,
    })
  })

  it('reads workplace from lng/lat', () => {
    setSearch('?lng=2.1734&lat=41.3851')
    expect(readUrlParams().workplace).toEqual([2.1734, 41.3851])
  })

  it('reads valid mode: foot', () => {
    setSearch('?mode=foot')
    expect(readUrlParams().mode).toBe('foot')
  })

  it('reads valid mode: cycling', () => {
    setSearch('?mode=cycling')
    expect(readUrlParams().mode).toBe('cycling')
  })

  it('reads valid mode: driving', () => {
    setSearch('?mode=driving')
    expect(readUrlParams().mode).toBe('driving')
  })

  it('reads valid minutes within range', () => {
    setSearch('?minutes=60')
    expect(readUrlParams().minutes).toBe(60)
  })

  it('reads boundary max minutes (120)', () => {
    setSearch('?minutes=120')
    expect(readUrlParams().minutes).toBe(120)
  })

  it('falls back to default for minutes above 120', () => {
    setSearch('?minutes=150')
    expect(readUrlParams().minutes).toBe(60)
  })

  it('falls back to default for minutes below 15', () => {
    setSearch('?minutes=10')
    expect(readUrlParams().minutes).toBe(60)
  })

  it('falls back to default for non-multiple-of-5 minutes', () => {
    setSearch('?minutes=17')
    expect(readUrlParams().minutes).toBe(60)
  })

  it('falls back to foot for unknown mode', () => {
    setSearch('?mode=teleportation')
    expect(readUrlParams().mode).toBe('foot')
  })

  it('falls back to default for out-of-range minutes', () => {
    setSearch('?minutes=99')
    expect(readUrlParams().minutes).toBe(60)
  })

  it('ignores NaN coordinates and uses default workplace', () => {
    setSearch('?lng=abc&lat=def')
    expect(readUrlParams().workplace).toEqual(DEFAULT_WORKPLACE)
  })

  it('ignores lone lat without lng', () => {
    setSearch('?lat=41.38')
    expect(readUrlParams().workplace).toEqual(DEFAULT_WORKPLACE)
  })

  it('reads all params together', () => {
    setSearch('?lng=2.17&lat=41.38&mode=foot&minutes=60')
    expect(readUrlParams()).toEqual({
      workplace: [2.17, 41.38],
      mode: 'foot',
      minutes: 60,
    })
  })
})

describe('store setters', () => {
  beforeEach(() => {
    useStore.setState({ workplace: null, mode: 'foot', minutes: 60, resultPolygon: null })
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
    useStore.getState().setMode('cycling')
    expect(useStore.getState().mode).toBe('cycling')
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
