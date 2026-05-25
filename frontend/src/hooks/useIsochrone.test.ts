import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useIsochrone } from './useIsochrone'
import { useStore, isochroneCacheKey } from '../store'
import * as otp from '../services/otp'

vi.mock('../services/otp')

const MULTIPOLYGON = {
  type: 'MultiPolygon' as const,
  coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]],
}

const WORKPLACE: [number, number] = [2.17, 41.38]
const MINUTES = 60
const CACHE_KEY = isochroneCacheKey(WORKPLACE, MINUTES)

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
    localStorage.clear()
    useStore.setState({
      workplace: WORKPLACE,
      minutes: MINUTES,
      resultPolygon: null,
    })
    vi.mocked(otp.fetchOtpIsochrone).mockResolvedValue(MULTIPOLYGON)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
    localStorage.clear()
  })

  it('starts loading immediately when workplace is set (cache miss)', () => {
    const { result } = renderHook(() => useIsochrone())
    expect(result.current.isLoading).toBe(true)
  })

  it('does not call fetch before 300ms', async () => {
    renderHook(() => useIsochrone())
    await act(async () => { vi.advanceTimersByTime(299) })
    expect(otp.fetchOtpIsochrone).not.toHaveBeenCalled()
  })

  it('fetches isochrone after 300ms debounce on cache miss', async () => {
    renderHook(() => useIsochrone())
    await advanceDebounce()
    expect(otp.fetchOtpIsochrone).toHaveBeenCalledTimes(1)
    expect(otp.fetchOtpIsochrone).toHaveBeenCalledWith(WORKPLACE, MINUTES)
  })

  it('writes result to store after fetch', async () => {
    renderHook(() => useIsochrone())
    await advanceDebounce()
    expect(useStore.getState().resultPolygon).toEqual(MULTIPOLYGON)
  })

  it('saves result to localStorage after fetch', async () => {
    renderHook(() => useIsochrone())
    await advanceDebounce()
    expect(JSON.parse(localStorage.getItem(CACHE_KEY)!)).toEqual(MULTIPOLYGON)
  })

  it('sets isLoading false after fetch completes', async () => {
    const { result } = renderHook(() => useIsochrone())
    await advanceDebounce()
    expect(result.current.isLoading).toBe(false)
  })

  it('uses cache when available — skips OTP call and loading state', async () => {
    localStorage.setItem(CACHE_KEY, JSON.stringify(MULTIPOLYGON))
    const { result } = renderHook(() => useIsochrone())
    expect(result.current.isLoading).toBe(false)
    expect(useStore.getState().resultPolygon).toEqual(MULTIPOLYGON)
    await advanceDebounce()
    expect(otp.fetchOtpIsochrone).not.toHaveBeenCalled()
  })

  it('does nothing when workplace is null', async () => {
    useStore.setState({ workplace: null })
    const { result } = renderHook(() => useIsochrone())
    await advanceDebounce()
    expect(otp.fetchOtpIsochrone).not.toHaveBeenCalled()
    expect(result.current.isLoading).toBe(false)
  })

  it('calls onError when fetch fails', async () => {
    vi.mocked(otp.fetchOtpIsochrone).mockRejectedValue(new Error('OTP 503'))
    const onError = vi.fn()
    renderHook(() => useIsochrone(onError))
    await advanceDebounce()
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'OTP 503' }))
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
})
