import { useContext, useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'
import { MapContext } from '../Map/MapContext'
import { useStore } from '../../store'
import { PRICE_RAMP, buildIconImageExpression } from './priceColors'
import { addLayerOrdered } from '../Map/layerOrder'
import { loadIdealistaFeatures } from '../../services/idealista/idealistaRawData'

const DOTS_SOURCE = 'idealista-prices-dots'
const DOTS_LAYER = 'idealista-prices-dots'
const LABEL_LAYER = 'idealista-prices-labels'
const PILL_ICON = 'idealista-pill'
const DOT_ICON_PREFIX = 'idealista-dot-'
const DOT_ICON_NAMES = PRICE_RAMP.map((_, i) => `${DOT_ICON_PREFIX}${i}`)
const GEOJSON_URL = `${import.meta.env.BASE_URL}data/idealista_prices.geojson`
const LABEL_MINZOOM = 15.3
const TEXT_FONT = ['Noto Sans Regular', 'Arial Unicode MS Regular']

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function makeCircleIcon(color: string): ImageData {
  const size = 24
  const cx = size / 2, cy = size / 2
  const r = size / 2 - 1.5
  const stroke = 1.5
  const [cr, cg, cb] = hexToRgb(color)
  const data = new Uint8ClampedArray(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const d = Math.sqrt((x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2)
      if (d >= r + 0.5) continue
      const alpha = Math.round(Math.min(1, r + 0.5 - d) * 255)
      if (d >= r - stroke) {
        data[i] = 255; data[i + 1] = 255; data[i + 2] = 255
      } else {
        data[i] = cr; data[i + 1] = cg; data[i + 2] = cb
      }
      data[i + 3] = alpha
    }
  }
  return new ImageData(data, size, size)
}

function addPillIcon(map: maplibregl.Map) {
  const W = 48, H = 22
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, W, H)
  ctx.shadowColor = 'rgba(0,0,0,0.18)'
  ctx.shadowBlur = 4
  ctx.shadowOffsetY = 1.5
  const r = 5, x = 2, y = 1, w = W - 4, h = H - 4
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
  ctx.fillStyle = '#fff'
  ctx.fill()
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
  ctx.strokeStyle = 'rgba(0,0,0,0.1)'
  ctx.lineWidth = 0.75
  ctx.stroke()
  map.addImage(PILL_ICON, ctx.getImageData(0, 0, W, H), {
    stretchX: [[12, W - 12]],
    stretchY: [[3, H - 5]],
    content: [5, 3, W - 5, H - 5],
  })
}

export function IdealistaPricesLayer() {
  const map = useContext(MapContext)
  const popupRef = useRef<maplibregl.Popup | null>(null)

  const visible = useStore((s) => s.idealistaPricesVisible)
  const priceRange = useStore((s) => s.idealistaPriceRange)
  const setBounds = useStore((s) => s.setIdealistaPriceBounds)

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map) return

    PRICE_RAMP.forEach((color, i) => {
      map.addImage(`${DOT_ICON_PREFIX}${i}`, makeCircleIcon(color))
    })
    addPillIcon(map)

    map.addSource(DOTS_SOURCE, { type: 'geojson', data: GEOJSON_URL })
    addLayerOrdered(map, {
      id: DOTS_LAYER,
      type: 'symbol',
      source: DOTS_SOURCE,
      layout: {
        visibility: 'none',
        'icon-image': buildIconImageExpression(DOT_ICON_NAMES, 100_000, 1_500_000) as maplibregl.ExpressionSpecification,
        'icon-size': ['interpolate', ['linear'], ['zoom'],
          10, 0.22, 13, 0.32, 15, 0.46, 17, 0.60,
        ] as maplibregl.ExpressionSpecification,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: {},
    }, DOTS_LAYER)

    addLayerOrdered(map, {
      id: LABEL_LAYER,
      type: 'symbol',
      source: DOTS_SOURCE,
      minzoom: LABEL_MINZOOM,
      layout: {
        visibility: 'none',
        'icon-image': PILL_ICON,
        'icon-text-fit': 'both',
        'icon-text-fit-padding': [3, 6, 3, 6] as [number, number, number, number],
        'text-field': ['get', 'priceText'] as maplibregl.ExpressionSpecification,
        'text-size': 8,
        'text-font': TEXT_FONT,
        'text-anchor': 'bottom',
        'text-offset': [0, -1.0] as [number, number],
        'icon-allow-overlap': false,
        'text-allow-overlap': false,
        'text-optional': true,
        'symbol-sort-key': ['get', 'price'] as maplibregl.ExpressionSpecification,
      },
      paint: { 'text-color': '#1a1a1a' },
    }, LABEL_LAYER)

    // Bounds detection — use p10/p90 to avoid extreme outliers skewing the slider
    loadIdealistaFeatures()
      .then((features) => {
        const prices = features.map((f) => f.properties?.price as number).filter((p) => p > 0)
        if (!prices.length) return
        const sorted = [...prices].sort((a, b) => a - b)
        const p10 = sorted[Math.floor(sorted.length * 0.1)]
        const p90 = sorted[Math.floor(sorted.length * 0.9)]
        setBounds([p10, p90])
      })
      .catch(console.error)

    const onLabelClick = (e: maplibregl.MapLayerMouseEvent) => {
      const f = e.features?.[0]
      if (!f) return
      const { adId } = f.properties as { adId: number }
      window.open(`https://www.idealista.com/inmueble/${adId}/`, '_blank', 'noopener,noreferrer')
    }

    const onDotClick = (e: maplibregl.MapLayerMouseEvent) => {
      if (map.getZoom() >= LABEL_MINZOOM) return
      const f = e.features?.[0]
      if (!f) return
      const { adId, priceText } = f.properties as { adId: number; priceText: string }
      const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number]
      popupRef.current?.remove()
      popupRef.current = new maplibregl.Popup({
        closeButton: false, closeOnClick: true, anchor: 'bottom', offset: 8,
        className: 'price-popup-wrapper', maxWidth: 'none',
      })
        .setLngLat(coords)
        .setHTML(
          `<a href="https://www.idealista.com/inmueble/${adId}/"
              target="_blank" rel="noopener noreferrer"
              class="price-popup-link">
            <span>${priceText}</span>
            <span class="price-popup-ext">↗</span>
          </a>`,
        )
        .addTo(map)
    }

    const setCursor = () => { map.getCanvas().style.cursor = 'pointer' }
    const clearCursor = () => { map.getCanvas().style.cursor = '' }

    map.on('click', LABEL_LAYER, onLabelClick)
    map.on('click', DOTS_LAYER, onDotClick)
    map.on('mouseenter', LABEL_LAYER, setCursor)
    map.on('mouseleave', LABEL_LAYER, clearCursor)
    map.on('mouseenter', DOTS_LAYER, setCursor)
    map.on('mouseleave', DOTS_LAYER, clearCursor)

    return () => {
      popupRef.current?.remove()
      map.off('click', LABEL_LAYER, onLabelClick)
      map.off('click', DOTS_LAYER, onDotClick)
      map.off('mouseenter', LABEL_LAYER, setCursor)
      map.off('mouseleave', LABEL_LAYER, clearCursor)
      map.off('mouseenter', DOTS_LAYER, setCursor)
      map.off('mouseleave', DOTS_LAYER, clearCursor)
      ;[LABEL_LAYER, DOTS_LAYER].forEach((id) => {
        if (map.getLayer(id)) map.removeLayer(id)
      })
      if (map.getSource(DOTS_SOURCE)) map.removeSource(DOTS_SOURCE)
      DOT_ICON_NAMES.forEach((n) => { if (map.hasImage(n)) map.removeImage(n) })
      if (map.hasImage(PILL_ICON)) map.removeImage(PILL_ICON)
    }
  }, [map]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Visibility ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !map.getLayer(DOTS_LAYER)) return
    map.setLayoutProperty(DOTS_LAYER, 'visibility', visible ? 'visible' : 'none')
    map.setLayoutProperty(LABEL_LAYER, 'visibility', visible ? 'visible' : 'none')
    if (!visible) popupRef.current?.remove()
  }, [map, visible])

  // ── Color + filter ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!map || !map.getLayer(DOTS_LAYER)) return
    const [min, max] = priceRange
    const iconExpr = buildIconImageExpression(DOT_ICON_NAMES, min, max) as maplibregl.ExpressionSpecification
    const filterExpr = ['all',
      ['>=', ['get', 'price'], min],
      ['<=', ['get', 'price'], max],
    ] as maplibregl.FilterSpecification
    map.setLayoutProperty(DOTS_LAYER, 'icon-image', iconExpr)
    map.setFilter(DOTS_LAYER, filterExpr)
    map.setFilter(LABEL_LAYER, filterExpr)
  }, [map, priceRange])

  return null
}
