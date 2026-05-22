import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsochrone } from './useIsochrone'
import { useStore } from '../store'
import * as ors from '../services/ors'
import * as otp from '../services/otp'

vi.mock('../services/ors')
vi.mock('../services/otp')

const POLYGON = { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }
const MULTIPOLYGON = {
  type: 'MultiPolygon' as const,
  coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]],
}

async function advanceDebounce() {
  await act(async () => {
    vi.advanceTimersByTime(300)
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('useIsochrone', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useStore.setState({
      workplace: [2.17, 41.38],
      mode: 'foot',
      minutes: 60,
      resultPolygon: null,
    })
    vi.mocked(ors.fetchIsochrone).mockResolvedValue(POLYGON)
    vi.mocked(otp.fetchOtpIsochrone).mockResolvedValue(MULTIPOLYGON)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it('starts loading immediately when workplace is set', () => {
    const { result } = renderHook(() => useIsochrone())
    expect(result.current.isLoading).toBe(true)
  })

  it('does not call fetch before 300ms', async () => {
    renderHook(() => useIsochrone())
    await act(async () => { vi.advanceTimersByTime(299) })
    expect(ors.fetchIsochrone).not.toHaveBeenCalled()
  })

  it('fetches isochrone after 300ms debounce', async () => {
    renderHook(() => useIsochrone())
    await advanceDebounce()
    expect(ors.fetchIsochrone).toHaveBeenCalledTimes(1)
    expect(ors.fetchIsochrone).toHaveBeenCalledWith([2.17, 41.38], 'foot', 60)
  })

  it('writes result to store after fetch', async () => {
    renderHook(() => useIsochrone())
    await advanceDebounce()
    expect(useStore.getState().resultPolygon).toEqual(POLYGON)
  })

  it('sets isLoading false after fetch completes', async () => {
    const { result } = renderHook(() => useIsochrone())
    await advanceDebounce()
    expect(result.current.isLoading).toBe(false)
  })

  it('does nothing when workplace is null', async () => {
    useStore.setState({ workplace: null })
    const { result } = renderHook(() => useIsochrone())
    await advanceDebounce()
    expect(ors.fetchIsochrone).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })

  it('calls onError when fetch fails', async () => {
    vi.mocked(ors.fetchIsochrone).mockRejectedValue(new Error('ORS 429'))
    const onError = vi.fn()
    renderHook(() => useIsochrone(onError))
    await advanceDebounce()
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'ORS 429' }))
  })

  it('keeps previous polygon on error', async () => {
    const prev = { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }
    useStore.setState({ resultPolygon: prev })
    vi.mocked(ors.fetchIsochrone).mockRejectedValue(new Error('fail'))
    renderHook(() => useIsochrone())
    await advanceDebounce()
    expect(useStore.getState().resultPolygon).toEqual(prev)
  })

  it('sets isLoading false even on error', async () => {
    vi.mocked(ors.fetchIsochrone).mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useIsochrone())
    await advanceDebounce()
    expect(result.current.isLoading).toBe(false)
  })

  describe('public_transport mode', () => {
    beforeEach(() => {
      useStore.setState({ mode: 'public_transport' })
    })

    it('routes public_transport to fetchOtpIsochrone, not fetchIsochrone', async () => {
      renderHook(() => useIsochrone())
      await advanceDebounce()
      expect(otp.fetchOtpIsochrone).toHaveBeenCalledTimes(1)
      expect(ors.fetchIsochrone).not.toHaveBeenCalled()
    })

    it('calls fetchOtpIsochrone with correct arguments', async () => {
      renderHook(() => useIsochrone())
      await advanceDebounce()
      expect(otp.fetchOtpIsochrone).toHaveBeenCalledWith([2.17, 41.38], 60)
    })

    it('writes MultiPolygon result to store', async () => {
      renderHook(() => useIsochrone())
      await advanceDebounce()
      expect(useStore.getState().resultPolygon).toEqual(MULTIPOLYGON)
    })

    it('calls onError when OTP fetch fails', async () => {
      vi.mocked(otp.fetchOtpIsochrone).mockRejectedValue(new Error('OTP 503'))
      const onError = vi.fn()
      renderHook(() => useIsochrone(onError))
      await advanceDebounce()
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'OTP 503' }))
    })
  })
})
