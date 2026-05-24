import { useEffect, useRef } from 'react'
import { useStore } from '../store'
import { usePinsStore } from '../store/pinsStore'
import { fetchOtpDuration } from '../services/otp'
import { computeTravelIndex } from '../services/analytics'
import type { PinAnalytics } from '../types/pins'

async function calcAnalytics(
  pinCoords: [number, number],
  workplace: [number, number],
): Promise<PinAnalytics> {
  const [walkRes, cycleRes, carRes, ptRes] = await Promise.allSettled([
    fetchOtpDuration(pinCoords, workplace, 'foot'),
    fetchOtpDuration(pinCoords, workplace, 'cycling'),
    fetchOtpDuration(pinCoords, workplace, 'driving'),
    fetchOtpDuration(pinCoords, workplace, 'transit'),
  ])

  const analytics: PinAnalytics = {
    walkingMinutes: walkRes.status === 'fulfilled' ? walkRes.value / 60 : undefined,
    cyclingMinutes: cycleRes.status === 'fulfilled' ? cycleRes.value / 60 : undefined,
    drivingMinutes: carRes.status === 'fulfilled' ? carRes.value / 60 : undefined,
    publicTransportMinutes: ptRes.status === 'fulfilled' ? ptRes.value / 60 : undefined,
    calculatedAt: new Date().toISOString(),
  }
  analytics.travelIndex = computeTravelIndex(analytics)
  return analytics
}

export function usePinAnalytics() {
  const { workplace } = useStore()
  const { pins, updatePinAnalytics } = usePinsStore()
  const workplaceRef = useRef(workplace)

  useEffect(() => {
    workplaceRef.current = workplace
  }, [workplace])

  // Recalculate all pins whenever workplace changes (including on initial mount)
  useEffect(() => {
    if (!workplace) return
    const currentPins = usePinsStore.getState().pins
    for (const pin of currentPins) {
      const wp = workplace
      calcAnalytics(pin.coordinates, wp).then((analytics) => {
        if (workplaceRef.current === wp) updatePinAnalytics(pin.id, analytics)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workplace])

  // Calculate analytics for newly added pins (no analytics yet)
  useEffect(() => {
    if (!workplace) return
    const newPins = pins.filter((p) => !p.analytics)
    for (const pin of newPins) {
      const wp = workplace
      calcAnalytics(pin.coordinates, wp).then((analytics) => {
        if (workplaceRef.current === wp) updatePinAnalytics(pin.id, analytics)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pins.length])
}

export { calcAnalytics }
