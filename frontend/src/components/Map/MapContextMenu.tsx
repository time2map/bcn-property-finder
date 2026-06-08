import { useContext, useEffect } from 'react'
import maplibregl from 'maplibre-gl'
import { MapContext } from './MapContext'
import { buildGoogleMapsUrl } from './googleMapsUrl'

export function MapContextMenu() {
  const map = useContext(MapContext)

  useEffect(() => {
    if (!map) return
    const canvas = map.getCanvas()
    const suppress = (e: Event) => e.preventDefault()
    canvas.addEventListener('contextmenu', suppress)
    return () => canvas.removeEventListener('contextmenu', suppress)
  }, [map])

  useEffect(() => {
    if (!map) return
    const popup = new maplibregl.Popup({
      closeButton: true,
      closeOnClick: true,
      offset: [0, -4],
    })

    function onContextMenu(e: maplibregl.MapMouseEvent) {
      const { lat, lng } = e.lngLat
      const url = buildGoogleMapsUrl(lat, lng)
      popup
        .setLngLat(e.lngLat)
        .setHTML(
          `<div style="font-size:12px;line-height:1.6;padding:2px 0">
            <a href="${url}" target="_blank" rel="noopener noreferrer"
               style="color:#1a73e8;text-decoration:none;white-space:nowrap">
              🛰 Open in Google Maps
            </a>
          </div>`,
        )
        .addTo(map)
    }

    map.on('contextmenu', onContextMenu)
    return () => {
      map.off('contextmenu', onContextMenu)
      popup.remove()
    }
  }, [map])

  return null
}
