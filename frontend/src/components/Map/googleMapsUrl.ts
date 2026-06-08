const ALT = 686
const FOV = 35
const TILT = 48.8

export function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/@${lat.toFixed(7)},${lng.toFixed(7)},${ALT}a,${FOV}y,0h,${TILT}t/`
}
