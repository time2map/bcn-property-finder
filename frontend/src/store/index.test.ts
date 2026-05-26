import { describe, it, expect, beforeEach } from 'vitest'
import { readUrlParams, useStore, DEFAULT_CENTER } from './index'

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
      mapCenter: DEFAULT_CENTER,
      minutes: 60,
      zoom: 12,
    })
  })

  it('reads workplace from lng/lat', () => {
    setSearch('?lng=2.1734&lat=41.3851')
    expect(readUrlParams().workplace).toEqual([2.1734, 41.3851])
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

  it('reads workplace and minutes together', () => {
    setSearch('?lng=2.17&lat=41.38&minutes=60')
    expect(readUrlParams()).toEqual({
      workplace: [2.17, 41.38],
      mapCenter: DEFAULT_CENTER,
      minutes: 60,
      zoom: 12,
    })
  })

  it('reads map center from cx/cy', () => {
    setSearch('?cx=2.19&cy=41.40')
    expect(readUrlParams().mapCenter).toEqual([2.19, 41.40])
  })

  it('falls back to default center when cx/cy are absent', () => {
    setSearch('?lng=2.17&lat=41.38')
    expect(readUrlParams().mapCenter).toEqual(DEFAULT_CENTER)
  })

  it('falls back to default center when cx/cy are invalid', () => {
    setSearch('?cx=abc&cy=def')
    expect(readUrlParams().mapCenter).toEqual(DEFAULT_CENTER)
  })

  it('falls back to default center when only cx is present', () => {
    setSearch('?cx=2.19')
    expect(readUrlParams().mapCenter).toEqual(DEFAULT_CENTER)
  })

  it('reads zoom from URL', () => {
    setSearch('?zoom=14.5')
    expect(readUrlParams().zoom).toBe(14.5)
  })

  it('falls back to default zoom for out-of-range value', () => {
    setSearch('?zoom=25')
    expect(readUrlParams().zoom).toBe(12)
  })

  it('falls back to default zoom for NaN', () => {
    setSearch('?zoom=abc')
    expect(readUrlParams().zoom).toBe(12)
  })
})

describe('store setters', () => {
  beforeEach(() => {
    useStore.setState({ workplace: null, minutes: 60, resultPolygon: null })
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
