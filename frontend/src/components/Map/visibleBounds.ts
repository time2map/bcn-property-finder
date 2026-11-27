import type * as maplibregl from 'maplibre-gl'
import type { Bounds } from '../../services/bestZonesConfig'
import { useSheetStore } from '../../store/sheetStore'

/**
 * Visible part of the map: the viewport minus the left filter panel, the right building card
 * (when open), and on a phone the bottom onboarding sheet or the conditions sheet. Best zones (038) never hide under them; the colour scale (TODO-032) fits to it.
 */
export function visibleBounds(map: maplibregl.Map): Bounds {
  const box = map.getContainer().getBoundingClientRect()
  const mid = box.left + box.width / 2
  let left = 0
  let right = box.width
  let bottom = box.height
  const panel = document.querySelector('.top-panel')?.getBoundingClientRect()
  if (panel && panel.right < mid) left = Math.max(0, panel.right - box.left)
  const card = document.querySelector('.building-card-overlay')?.getBoundingClientRect()
  if (card && card.left > mid) right = Math.min(box.width, card.left - box.left)
  // Mobile onboarding sheet at the bottom: the map above it is what the person sees.
  const sheet = document.querySelector('.onboarding-sheet')?.getBoundingClientRect()
  if (sheet && sheet.bottom >= box.top + box.height - 2) bottom = Math.max(0, sheet.top - box.top)
  // Phone sheet (TODO-062): the map above peek or half. At full the map stays where half left it.
  if (document.querySelector('.mobile-sheet')) bottom = Math.max(0, box.height - useSheetStore.getState().mapInset)
  const corners = [[left, 0], [right, 0], [right, bottom], [left, bottom]]
    .map(([x, y]) => map.unproject([x, y]))
  const lngs = corners.map((c) => c.lng)
  const lats = corners.map((c) => c.lat)
  return [Math.min(...lngs), Math.min(...lats), Math.max(...lngs), Math.max(...lats)]
}
