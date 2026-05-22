import type { MultiPolygon } from 'geojson'
import type { TransportMode } from '../store'

const OTP_MODES: Record<TransportMode, string> = {
  public_transport: 'WALK,TRANSIT',
  foot: 'WALK',
  cycling: 'BIKE',
  driving: 'CAR',
}

export function getNextMondayMadridISO(): string {
  const now = new Date()

  // Day of week in Madrid timezone (short English name: "Mon", "Tue", …)
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

  // tzPart is "GMT+01:00" or "GMT+02:00"
  const offset = tzPart.slice(3)

  return `${dateStr}T09:00:00${offset}`
}

export async function fetchOtpIsochrone(
  lngLat: [number, number],
  mode: TransportMode,
  minutes: number,
): Promise<MultiPolygon> {
  const baseUrl = (import.meta.env.VITE_OTP_URL as string | undefined) ?? 'http://localhost:8080'
  const [lng, lat] = lngLat
  const params = new URLSearchParams({
    location: `${lat},${lng}`,
    time: getNextMondayMadridISO(),
    cutoff: `PT${minutes}M`,
    modes: OTP_MODES[mode],
  })
  const res = await fetch(`${baseUrl}/otp/traveltime/isochrone?${params}`)
  if (!res.ok) throw new Error(`OTP ${res.status}`)
  const data = (await res.json()) as { features: Array<{ geometry: MultiPolygon }> }
  return data.features[0].geometry
}
