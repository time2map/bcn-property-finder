import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUrlState } from './useUrlState'
import { useStore, DEFAULT_CENTER } from '../store'

function lastUrl() {
  return (window.history.replaceState as ReturnType<typeof vi.spyOn>).mock.calls.at(-1)?.[2] as string
}

describe('useUrlState', () => {
  beforeEach(() => {
    useStore.setState({ workplace: null, minutes: 60, mapCenter: DEFAULT_CENTER })
    vi.spyOn(window.history, 'replaceState')
  })

  it('writes default params to URL on mount', () => {
    renderHook(() => useUrlState())
    expect(window.history.replaceState).toHaveBeenCalledWith(
      null,
      '',
      expect.stringContaining('minutes=60'),
    )
  })

  it('never writes lng/lat to URL', () => {
    useStore.setState({ workplace: [2.1734, 41.3851] })
    renderHook(() => useUrlState())
    expect(lastUrl()).not.toContain('lng=')
    expect(lastUrl()).not.toContain('lat=')
  })

  it('writes non-default minutes to URL', () => {
    useStore.setState({ minutes: 90 })
    renderHook(() => useUrlState())
    expect(lastUrl()).toContain('minutes=90')
  })

  it('writes map center as cx/cy on mount', () => {
    useStore.setState({ mapCenter: [2.1734, 41.3851] })
    renderHook(() => useUrlState())
    expect(lastUrl()).toContain('cx=2.17340')
    expect(lastUrl()).toContain('cy=41.38510')
  })

  it('updates cx/cy in URL when mapCenter changes', () => {
    const { rerender } = renderHook(() => useUrlState())
    act(() => { useStore.getState().setMapCenter([2.19, 41.40]) })
    rerender()
    expect(lastUrl()).toContain('cx=2.19000')
    expect(lastUrl()).toContain('cy=41.40000')
  })

  it('URL always contains cx and cy even with default center', () => {
    renderHook(() => useUrlState())
    expect(lastUrl()).toContain('cx=')
    expect(lastUrl()).toContain('cy=')
  })
})

describe('useUrlState: the configuration in the address (TODO-053)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    localStorage.clear()
    useStore.setState({
      workplace: null, minutes: 60, mapCenter: DEFAULT_CENTER,
      conditions: { noiseMaxDb: 65, priceMaxEurM2: 4000, cityCoreMaxMin: 30, walkMaxMin: 10, localsMin: 7.5 },
      conditionOrder: ['noise', 'poiAccess', 'cityCore', 'openPrice', 'risk'], flatAreaM2: 70, contrastBoost: false,
    })
    vi.spyOn(window.history, 'replaceState')
  })
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

  it('has no c while everything is the default', () => {
    renderHook(() => useUrlState())
    expect(lastUrl()).not.toContain('c=')
  })

  it('writes c after a pause, not at every change', () => {
    renderHook(() => useUrlState())
    act(() => { useStore.getState().setConditions({ ...useStore.getState().conditions, noiseMaxDb: 58 }) })
    expect(lastUrl()).not.toContain('c=')
    act(() => { vi.advanceTimersByTime(299) })
    expect(lastUrl()).not.toContain('c=')
    act(() => { vi.advanceTimersByTime(2) })
    expect(lastUrl()).toContain('&c=n:58')
  })

  it('writes the separators as they are, so the link stays readable', () => {
    renderHook(() => useUrlState())
    act(() => { useStore.getState().setConditions({ ...useStore.getState().conditions, noiseMaxDb: 58, walkMaxMin: 15 }) })
    act(() => { vi.advanceTimersByTime(400) })
    expect(lastUrl()).toContain('c=n:58;w:15')
    expect(lastUrl()).not.toContain('%3A')
  })

  it('moving the map keeps c, and a new c keeps the view', () => {
    renderHook(() => useUrlState())
    act(() => { useStore.getState().setConditions({ ...useStore.getState().conditions, noiseMaxDb: 58 }) })
    act(() => { vi.advanceTimersByTime(400) })
    act(() => { useStore.getState().setMapCenter([2.19, 41.4]) })
    expect(lastUrl()).toContain('cx=2.19000')
    expect(lastUrl()).toContain('c=n:58')
    act(() => { useStore.getState().setFlatArea(90) })
    act(() => { vi.advanceTimersByTime(400) })
    expect(lastUrl()).toContain('cx=2.19000')
    expect(lastUrl()).toContain('fa:90')
  })

  it('c goes away again when the settings are back to the defaults', () => {
    renderHook(() => useUrlState())
    act(() => { useStore.getState().setConditions({ ...useStore.getState().conditions, noiseMaxDb: 58 }) })
    act(() => { vi.advanceTimersByTime(400) })
    expect(lastUrl()).toContain('c=')
    act(() => { useStore.getState().setConditions({ ...useStore.getState().conditions, noiseMaxDb: 65 }) })
    act(() => { vi.advanceTimersByTime(400) })
    expect(lastUrl()).not.toContain('c=')
  })

  it('writes c at once on mount when the settings already differ (a link was opened)', () => {
    useStore.setState({ conditions: { ...useStore.getState().conditions, noiseMaxDb: 52 } })
    renderHook(() => useUrlState())
    expect(lastUrl()).toContain('c=n:52')
  })
})
