import { useEffect } from 'react'
import type maplibregl from 'maplibre-gl'
import { useMap } from '../Map/MapContext'
import { svgToImage } from './poiUtils'
import { addLayerOrdered } from '../Map/layerOrder'

import grocerySvg from '@mapbox/maki/icons/grocery.svg?raw'
import pharmacySvg from '@mapbox/maki/icons/pharmacy.svg?raw'
import parkSvg from '@mapbox/maki/icons/park.svg?raw'
import schoolSvg from '@mapbox/maki/icons/school.svg?raw'
import playgroundSvg from '@mapbox/maki/icons/playground.svg?raw'
import doctorSvg from '@mapbox/maki/icons/doctor.svg?raw'
import cafeSvg from '@mapbox/maki/icons/cafe.svg?raw'
import restaurantSvg from '@mapbox/maki/icons/restaurant.svg?raw'
import beachSvg from '@mapbox/maki/icons/beach.svg?raw'

const SOURCE_ID = 'poi-tiles'
const LAYER_PRIORITY = 'poi-priority'
const LAYER_SECONDARY = 'poi-secondary'

const TEXT_FONT = ['Noto Sans Regular', 'Arial Unicode MS Regular']

const ICONS = [
  { name: 'poi-grocery',    svg: grocerySvg },
  { name: 'poi-pharmacy',   svg: pharmacySvg },
  { name: 'poi-park',       svg: parkSvg },
  { name: 'poi-school',     svg: schoolSvg },
  { name: 'poi-playground', svg: playgroundSvg },
  { name: 'poi-doctor',     svg: doctorSvg },
  { name: 'poi-cafe',       svg: cafeSvg },
  { name: 'poi-restaurant', svg: restaurantSvg },
  { name: 'poi-beach',      svg: beachSvg },
] as const

async function loadIcons(map: maplibregl.Map): Promise<void> {
  await Promise.all(
    ICONS.map(async ({ name, svg }) => {
      if (map.hasImage(name)) return
      const img = await svgToImage(svg)
      map.addImage(name, img, { pixelRatio: 2 })
    }),
  )
}

// Maps OSM feature tags → icon name
const ICON_IMAGE_EXPR: maplibregl.ExpressionSpecification = [
  'case',
  ['==', ['get', 'shop'],    'supermarket'],  'poi-grocery',
  ['==', ['get', 'amenity'], 'pharmacy'],     'poi-pharmacy',
  ['==', ['get', 'leisure'], 'park'],         'poi-park',
  ['==', ['get', 'amenity'], 'school'],       'poi-school',
  ['==', ['get', 'amenity'], 'kindergarten'], 'poi-playground',
  ['==', ['get', 'amenity'], 'doctors'],      'poi-doctor',
  ['==', ['get', 'amenity'], 'clinic'],       'poi-doctor',
  ['==', ['get', 'amenity'], 'cafe'],         'poi-cafe',
  ['==', ['get', 'amenity'], 'restaurant'],   'poi-restaurant',
  ['==', ['get', 'natural'], 'beach'],        'poi-beach',
  'poi-grocery', // unreachable fallback — filter always matches one branch above
]

const PRIORITY_FILTER: maplibregl.ExpressionSpecification = [
  'any',
  ['==', ['get', 'shop'],    'supermarket'],
  ['==', ['get', 'amenity'], 'pharmacy'],
  ['==', ['get', 'leisure'], 'park'],
  ['==', ['get', 'amenity'], 'school'],
  ['==', ['get', 'amenity'], 'kindergarten'],
  ['==', ['get', 'amenity'], 'doctors'],
  ['==', ['get', 'amenity'], 'clinic'],
  ['==', ['get', 'natural'], 'beach'],
]

const SECONDARY_FILTER: maplibregl.ExpressionSpecification = [
  'any',
  ['==', ['get', 'amenity'], 'cafe'],
  ['==', ['get', 'amenity'], 'restaurant'],
]

export function PoiLayer() {
  const map = useMap()

  useEffect(() => {
    if (!map) return

    let cancelled = false

    async function setup() {
      if (!map) return
      await loadIcons(map)
      if (cancelled || map.getSource(SOURCE_ID)) return

      map.addSource(SOURCE_ID, {
        type: 'vector',
        url: `pmtiles://${import.meta.env.BASE_URL}barcelona_poi.pmtiles`,
        attribution: 'OpenStreetMap contributors',
      })

      // Priority POIs: supermarket, pharmacy, school, kindergarten, clinic, park, beach
      addLayerOrdered(map, {
        id: LAYER_PRIORITY,
        type: 'symbol',
        source: SOURCE_ID,
        'source-layer': 'poi',
        minzoom: 14,
        filter: PRIORITY_FILTER,
        layout: {
          'icon-image': ICON_IMAGE_EXPR,
          'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.65, 18, 1.0],
          'icon-allow-overlap': false,
          'text-field': ['coalesce', ['get', 'name'], ''],
          'text-font': TEXT_FONT,
          'text-size': 9,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-max-width': 8,
          'text-optional': true,
        },
        paint: {
          'text-color': '#6b7280',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
          'text-opacity': ['interpolate', ['linear'], ['zoom'], 14.9, 0, 15, 1],
        },
      }, LAYER_PRIORITY)

      // Secondary (dense) POIs: cafe, restaurant — visible only at street zoom
      addLayerOrdered(map, {
        id: LAYER_SECONDARY,
        type: 'symbol',
        source: SOURCE_ID,
        'source-layer': 'poi',
        minzoom: 16,
        filter: SECONDARY_FILTER,
        layout: {
          'icon-image': ICON_IMAGE_EXPR,
          'icon-size': 0.6,
          'icon-allow-overlap': false,
          'text-field': ['coalesce', ['get', 'name'], ''],
          'text-font': TEXT_FONT,
          'text-size': 9,
          'text-offset': [0, 1.2],
          'text-anchor': 'top',
          'text-max-width': 8,
          'text-optional': true,
        },
        paint: {
          'text-color': '#6b7280',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.5,
        },
      }, LAYER_SECONDARY)
    }

    setup().catch(() => { /* fail silently — non-critical overlay */ })

    return () => {
      cancelled = true
      try {
        if (map.getLayer(LAYER_SECONDARY)) map.removeLayer(LAYER_SECONDARY)
        if (map.getLayer(LAYER_PRIORITY))  map.removeLayer(LAYER_PRIORITY)
        if (map.getSource(SOURCE_ID))      map.removeSource(SOURCE_ID)
      } catch { /* map may already be destroyed */ }
    }
  }, [map])

  return null
}
