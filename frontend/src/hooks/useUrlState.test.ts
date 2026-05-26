import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUrlState } from './useUrlState'
import { useStore, DEFAULT_CENTER } from '../store'

function lastUrl() {
  return (window.history.replaceState as ReturnType<typeof vi.spyOn>).mock.calls.at(-1)?.[2] as string
}

describe('useUrlState', () => {
  beforeEach(() => {
    useStore.setState({ workplace: null, minutes: 60, mapCenter: DEFAULT_CENTER, resultPolygon: null })
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

  it('omits lng/lat when workplace is null', () => {
    renderHook(() => useUrlState())
    expect(lastUrl()).not.toContain('lng=')
    expect(lastUrl()).not.toContain('lat=')
  })

  it('writes workplace coords when set', () => {
    useStore.setState({ workplace: [2.1734, 41.3851] })
    renderHook(() => useUrlState())
    expect(lastUrl()).toContain('lng=2.17340')
    expect(lastUrl()).toContain('lat=41.38510')
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
