import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useUrlState } from './useUrlState'
import { useStore } from '../store'

describe('useUrlState', () => {
  beforeEach(() => {
    useStore.setState({ workplace: null, mode: 'foot-walking', minutes: 30, resultPolygon: null })
    vi.spyOn(window.history, 'replaceState')
  })

  it('writes default params to URL on mount', () => {
    renderHook(() => useUrlState())
    expect(window.history.replaceState).toHaveBeenCalledWith(
      null,
      '',
      expect.stringContaining('mode=foot-walking'),
    )
    expect(window.history.replaceState).toHaveBeenCalledWith(
      null,
      '',
      expect.stringContaining('minutes=30'),
    )
  })

  it('omits lng/lat when workplace is null', () => {
    renderHook(() => useUrlState())
    const url = (window.history.replaceState as ReturnType<typeof vi.spyOn>).mock.calls.at(-1)?.[2] as string
    expect(url).not.toContain('lng=')
    expect(url).not.toContain('lat=')
  })

  it('writes workplace coords when set', () => {
    useStore.setState({ workplace: [2.1734, 41.3851] })
    renderHook(() => useUrlState())
    const url = (window.history.replaceState as ReturnType<typeof vi.spyOn>).mock.calls.at(-1)?.[2] as string
    expect(url).toContain('lng=2.17340')
    expect(url).toContain('lat=41.38510')
  })

  it('writes cycling-regular mode to URL', () => {
    useStore.setState({ mode: 'cycling-regular' })
    renderHook(() => useUrlState())
    const url = (window.history.replaceState as ReturnType<typeof vi.spyOn>).mock.calls.at(-1)?.[2] as string
    expect(url).toContain('mode=cycling-regular')
  })

  it('writes non-default minutes to URL', () => {
    useStore.setState({ minutes: 20 })
    renderHook(() => useUrlState())
    const url = (window.history.replaceState as ReturnType<typeof vi.spyOn>).mock.calls.at(-1)?.[2] as string
    expect(url).toContain('minutes=20')
  })
})
