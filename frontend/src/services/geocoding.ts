const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'

export async function geocodeAddress(address: string | null | undefined): Promise<[number, number] | null> {
  if (!address) return null

  try {
    const query = address.toLowerCase().includes('barcelona') ? address : `${address}, Barcelona`
    const url = `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1`
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'en', 'User-Agent': 'bcn-property-finder/1.0' },
    })
    if (!res.ok) return null

    const results = await res.json()
    if (!Array.isArray(results) || results.length === 0) return null

    const { lon, lat } = results[0]
    return [parseFloat(lon), parseFloat(lat)]
  } catch {
    return null
  }
}
