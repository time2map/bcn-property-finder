import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsochrone } from './useIsochrone'
import { useStore } from '../store'
import * as otp from '../services/otp'
import type { TransportMode } from '../store'

vi.mock('../services/otp')

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
    expect(otp.fetchOtpIsochrone).not.toHaveBeenCalled()
  })

  it('fetches isochrone after 300ms debounce', async () => {
    renderHook(() => useIsochrone())
    await advanceDebounce()
    expect(otp.fetchOtpIsochrone).toHaveBeenCalledTimes(1)
    expect(otp.fetchOtpIsochrone).toHaveBeenCalledWith([2.17, 41.38], 'foot', 60)
  })

  it('writes result to store after fetch', async () => {
    renderHook(() => useIsochrone())
    await advanceDebounce()
    expect(useStore.getState().resultPolygon).toEqual(MULTIPOLYGON)
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
    expect(otp.fetchOtpIsochrone).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })

  it('calls onError when fetch fails', async () => {
    vi.mocked(otp.fetchOtpIsochrone).mockRejectedValue(new Error('OTP 429'))
    const onError = vi.fn()
    renderHook(() => useIsochrone(onError))
    await advanceDebounce()
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'OTP 429' }))
  })

  it('keeps previous polygon on error', async () => {
    useStore.setState({ resultPolygon: MULTIPOLYGON })
    vi.mocked(otp.fetchOtpIsochrone).mockRejectedValue(new Error('fail'))
    renderHook(() => useIsochrone())
    await advanceDebounce()
    expect(useStore.getState().resultPolygon).toEqual(MULTIPOLYGON)
  })

  it('sets isLoading false even on error', async () => {
    vi.mocked(otp.fetchOtpIsochrone).mockRejectedValue(new Error('fail'))
    const { result } = renderHook(() => useIsochrone())
    await advanceDebounce()
    expect(result.current.isLoading).toBe(false)
  })

  it.each<TransportMode>(['public_transport', 'foot', 'cycling', 'driving'])(
    'routes %s mode to fetchOtpIsochrone with correct mode arg',
    async (mode) => {
      useStore.setState({ mode })
      renderHook(() => useIsochrone())
      await advanceDebounce()
      expect(otp.fetchOtpIsochrone).toHaveBeenCalledWith([2.17, 41.38], mode, 60)
    },
  )
})
