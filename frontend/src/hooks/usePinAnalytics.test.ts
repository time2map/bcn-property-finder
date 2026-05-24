import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePinAnalytics, calcAnalytics } from './usePinAnalytics'
import { useStore } from '../store'
import { usePinsStore } from '../store/pinsStore'
import * as otp from '../services/otp'

vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() })

describe('calcAnalytics', () => {
  beforeEach(() => {
    vi.spyOn(otp, 'fetchOtpDuration')
  })

  it('converts seconds to minutes for all modes', async () => {
    vi.mocked(otp.fetchOtpDuration).mockResolvedValue(600) // 10 min for all

    const result = await calcAnalytics([2.17, 41.38], [2.19, 41.40])
    expect(result.walkingMinutes).toBeCloseTo(10)
    expect(result.cyclingMinutes).toBeCloseTo(10)
    expect(result.drivingMinutes).toBeCloseTo(10)
    expect(result.publicTransportMinutes).toBeCloseTo(10)
  })

  it('handles OTP failure for transit gracefully — sets pt to undefined', async () => {
    vi.mocked(otp.fetchOtpDuration).mockImplementation((_f, _t, mode) =>
      mode === 'transit'
        ? Promise.reject(new Error('OTP down'))
        : Promise.resolve(600),
    )

    const result = await calcAnalytics([2.17, 41.38], [2.19, 41.40])
    expect(result.publicTransportMinutes).toBeUndefined()
    expect(result.walkingMinutes).toBeDefined()
  })

  it('handles OTP failure for walking — sets walk to undefined', async () => {
    vi.mocked(otp.fetchOtpDuration).mockImplementation((_f, _t, mode) =>
      mode === 'foot'
        ? Promise.reject(new Error('OTP down'))
        : Promise.resolve(900),
    )

    const result = await calcAnalytics([2.17, 41.38], [2.19, 41.40])
    expect(result.walkingMinutes).toBeUndefined()
    expect(result.publicTransportMinutes).toBeCloseTo(15)
  })

  it('computes travelIndex from available modes', async () => {
    vi.mocked(otp.fetchOtpDuration).mockResolvedValue(600)

    const result = await calcAnalytics([2.17, 41.38], [2.19, 41.40])
    expect(result.travelIndex).toBeDefined()
    expect(result.travelIndex).toBeGreaterThan(0)
    expect(result.travelIndex).toBeLessThanOrEqual(100)
  })

  it('sets calculatedAt to a valid ISO string', async () => {
    vi.mocked(otp.fetchOtpDuration).mockResolvedValue(300)

    const result = await calcAnalytics([2.17, 41.38], [2.19, 41.40])
    expect(() => new Date(result.calculatedAt)).not.toThrow()
    expect(new Date(result.calculatedAt).getTime()).toBeGreaterThan(0)
  })
})

describe('usePinAnalytics', () => {
  beforeEach(() => {
    vi.spyOn(otp, 'fetchOtpDuration').mockResolvedValue(600)
    useStore.setState({ workplace: null, minutes: 60, resultPolygon: null })
    usePinsStore.setState({ pins: [], selectedPinId: null, isAddingPin: false })
  })

  it('does not trigger analytics when workplace is null', () => {
    renderHook(() => usePinAnalytics())
    expect(otp.fetchOtpDuration).not.toHaveBeenCalled()
  })

  it('triggers analytics for existing pins when workplace is set', async () => {
    const pinId = usePinsStore.getState().addPin([2.17, 41.38])
    useStore.setState({ ...useStore.getState(), workplace: [2.19, 41.40] })
    renderHook(() => usePinAnalytics())

    await vi.waitFor(() => {
      expect(otp.fetchOtpDuration).toHaveBeenCalled()
    })

    await vi.waitFor(() => {
      const pin = usePinsStore.getState().pins.find((p) => p.id === pinId)
      expect(pin?.analytics).toBeDefined()
    })
  })

  it('triggers analytics when a new pin is added after workplace is set', async () => {
    useStore.setState({ ...useStore.getState(), workplace: [2.19, 41.40] })
    const { rerender } = renderHook(() => usePinAnalytics())

    const pinId = usePinsStore.getState().addPin([2.17, 41.38])
    rerender()

    await vi.waitFor(() => {
      const pin = usePinsStore.getState().pins.find((p) => p.id === pinId)
      expect(pin?.analytics).toBeDefined()
    })
  })
})
