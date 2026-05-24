import type { MultiPolygon } from 'geojson'

export type OtpMode = 'foot' | 'cycling' | 'driving' | 'transit'

const OTP_MODES: Record<OtpMode, string> = {
  foot: 'WALK',
  cycling: 'BICYCLE',
  driving: 'CAR',
  // TRANSIT mode is broken in OTP2 v1 REST API — explicitly list transit submodes
  transit: (import.meta.env.VITE_OTP_TRANSIT_MODES as string | undefined) ?? 'WALK,SUBWAY,BUS,TRAM,RAIL',
}

function getOtpBaseUrl(): string {
  return (import.meta.env.VITE_OTP_URL as string | undefined) ?? 'http://localhost:8080'
}

function getDepartureTime(): string {
  return (import.meta.env.VITE_OTP_DEPARTURE_TIME as string | undefined) ?? '09:00:00'
}

function getTransitNumItineraries(): string {
  return (import.meta.env.VITE_OTP_TRANSIT_ITINERARIES as string | undefined) ?? '3'
}

export function getNextMondayMadridISO(): string {
  const now = new Date()

  const weekday = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Madrid',
    weekday: 'short',
  }).format(now)

  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dayIdx = WEEKDAYS.indexOf(weekday)
  const daysAhead = dayIdx === 1 ? 7 : (8 - dayIdx) % 7

  const target = new Date(now.getTime() + daysAhead * 86400000)

  const dateParts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(target)

  const year = dateParts.find((p) => p.type === 'year')!.value
  const month = dateParts.find((p) => p.type === 'month')!.value
  const day = dateParts.find((p) => p.type === 'day')!.value
  const dateStr = `${year}-${month}-${day}`

  // Determine Madrid UTC offset for that date (use noon to avoid DST-transition edge cases)
  const noonUTC = new Date(`${dateStr}T12:00:00Z`)
  const tzPart =
    new Intl.DateTimeFormat('en', {
      timeZone: 'Europe/Madrid',
      timeZoneName: 'longOffset',
    })
      .formatToParts(noonUTC)
      .find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+01:00'

  return `${dateStr}T${getDepartureTime()}${tzPart.slice(3)}`
}

export async function fetchOtpDuration(
  from: [number, number],
  to: [number, number],
  mode: OtpMode,
): Promise<number> {
  const params = new URLSearchParams({
    fromPlace: `${from[1]},${from[0]}`,
    toPlace: `${to[1]},${to[0]}`,
    time: getDepartureTime(),
    date: getNextMondayMadridISO().slice(0, 10),
    mode: OTP_MODES[mode],
    numItineraries: mode === 'transit' ? getTransitNumItineraries() : '1',
  })
  const res = await fetch(`${getOtpBaseUrl()}/otp/routers/default/plan?${params}`)
  if (!res.ok) throw new Error(`OTP ${res.status}`)
  const data = (await res.json()) as {
    plan: { itineraries: Array<{ duration: number }> }
  }
  if (!data.plan?.itineraries?.length) throw new Error('OTP: no itineraries')
  return Math.min(...data.plan.itineraries.map((it) => it.duration))
}

export async function fetchOtpIsochrone(
  lngLat: [number, number],
  minutes: number,
): Promise<MultiPolygon> {
  const [lng, lat] = lngLat
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    time: getNextMondayMadridISO(),
    cutoff: `PT${minutes}M`,
    modes: 'WALK,TRANSIT',
  })
  const res = await fetch(`${getOtpBaseUrl()}/otp/traveltime/isochrone?${params}`)
  if (!res.ok) throw new Error(`OTP ${res.status}`)
  const data = (await res.json()) as { features: Array<{ geometry: MultiPolygon }> }
  return data.features[0].geometry
}
