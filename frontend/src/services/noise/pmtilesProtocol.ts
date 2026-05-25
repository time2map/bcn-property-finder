import { Protocol } from 'pmtiles'
import maplibregl from 'maplibre-gl'

let registered = false

export function registerPmtilesProtocol() {
  if (registered) return
  const protocol = new Protocol()
  maplibregl.addProtocol('pmtiles', protocol.tile.bind(protocol))
  registered = true
}
