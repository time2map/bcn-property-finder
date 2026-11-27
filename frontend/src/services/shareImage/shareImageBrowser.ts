import type * as maplibregl from 'maplibre-gl'
import { PHONE_QUERY } from '../phoneConfig'
import { captureMap } from './captureMap'
import i18n from '../../i18n'
import { SITE_URL, siteLabel } from './shareConfig'
import { drawShareImage, FONT, FORMAT_SIZE, type Ctx } from './shareImageDraw'
import { shareFileName, type ShareModel } from './shareImageModel'

// The "Save image" button (TODO-063), in the browser: draws the 4:5 picture of a building from the live map, then
// hands it to the system share sheet on a phone, or downloads it.

async function loadFonts(): Promise<void> {
  if (!document.fonts) return
  await Promise.all([400, 600, 700].map((w) => document.fonts.load(`${w} 24px ${FONT}`).catch(() => [])))
}

/** The picture as a PNG: the live map around `lngLat` under the panel of `model`. */
export async function renderShareBlob(map: maplibregl.Map, lngLat: [number, number], model: ShareModel): Promise<Blob> {
  await loadFonts()
  const { width, height } = FORMAT_SIZE.post
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('No 2D canvas')
  await drawShareImage(ctx as Ctx, model, {
    format: 'post', attribution: i18n.t('card:share.mapCredit'), domain: siteLabel(SITE_URL), drawMap: captureMap(map, lngLat),
  })
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('The picture could not be made'))), 'image/png'))
}

export type Delivery = 'shared' | 'saved' | 'cancelled'

/**
 * Gives the picture to the person: the share sheet with the picture and the link where the phone can share files,
 * a download elsewhere.
 */
export async function deliverImage(blob: Blob, place: string, url: string): Promise<Delivery> {
  const name = shareFileName(place, 'png')
  const file = new File([blob], name, { type: 'image/png' })
  const phone = typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches
  if (phone && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Barcelona livability map', text: url })
      return 'shared'
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled' // the person closed the sheet
      // Any other failure: fall back to the download.
    }
  }
  const href = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = href
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(href), 10_000)
  return 'saved'
}
