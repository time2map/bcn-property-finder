import type { Polygon } from 'geojson'
import type { TransportMode } from '../store'

const ORS_PROFILES: Record<TransportMode, string> = {
  foot: 'foot-walking',
  cycling: 'cycling-regular',
  driving: 'driving-car',
}

export function getOrsProfile(mode: TransportMode): string {
  return ORS_PROFILES[mode]
}

export async function fetchIsochrone(
  lngLat: [number, number],
  mode: TransportMode,
  minutes: number,
): Promise<Polygon> {
  const profile = getOrsProfile(mode)
  const apiKey = import.meta.env.VITE_ORS_API_KEY as string
  const res = await fetch(`https://api.openrouteservice.org/v2/isochrones/${profile}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    body: JSON.stringify({
      locations: [[lngLat[0], lngLat[1]]],
      range: [minutes * 60],
    }),
  })
  if (!res.ok) throw new Error(`ORS ${res.status}`)
  const data = (await res.json()) as { features: Array<{ geometry: Polygon }> }
  return data.features[0].geometry
}
