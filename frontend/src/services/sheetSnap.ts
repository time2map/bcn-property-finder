/** The bottom sheet of the phone layout (TODO-062): three resting heights and where a released drag settles. */
export type SheetPosition = 'peek' | 'half' | 'full'
export const SHEET_POSITIONS: readonly SheetPosition[] = ['peek', 'half', 'full']

/** What peek shows above the home indicator: the grab handle and a two-line header. */
export const PEEK_CONTENT_PX = 92
const HALF_SHARE = 0.5
/** What the search pill takes at the top: 8 px above it, 52 px of it and 12 px of air under it. Full stops there. */
export const TOP_RESERVE_PX = 72
/** Minimum difference between two neighbouring positions on a very short screen. */
const MIN_STEP_PX = 80
/** A release faster than this (px per ms) is a flick: it moves one position, however short the drag. */
export const FLICK_PX_PER_MS = 0.5

export type SheetHeights = Record<SheetPosition, number>

export function sheetHeights(viewportHeight: number, safeBottom = 0, safeTop = 0): SheetHeights {
  const peek = PEEK_CONTENT_PX + safeBottom
  const half = Math.max(Math.round(viewportHeight * HALF_SHARE), peek + MIN_STEP_PX)
  const full = Math.max(viewportHeight - TOP_RESERVE_PX - safeTop, half + MIN_STEP_PX)
  return { peek, half, full }
}

export const clampHeight = (height: number, heights: SheetHeights): number =>
  Math.min(heights.full, Math.max(heights.peek, height))

/**
 * Where a drag settles when released at `height`. `velocity` is in px per ms, positive when the sheet was
 * growing (moving up). A flick goes to the next position in its direction; a slow release to the nearest one.
 */
export function snapPosition(height: number, velocity: number, heights: SheetHeights): SheetPosition {
  if (velocity >= FLICK_PX_PER_MS) {
    return SHEET_POSITIONS.find((p) => heights[p] > height + 8) ?? 'full'
  }
  if (velocity <= -FLICK_PX_PER_MS) {
    return [...SHEET_POSITIONS].reverse().find((p) => heights[p] < height - 8) ?? 'peek'
  }
  return SHEET_POSITIONS.reduce((best, p) =>
    Math.abs(heights[p] - height) < Math.abs(heights[best] - height) ? p : best, 'peek' as SheetPosition)
}

/** How far the map is pushed up: the sheet at peek or half; at full the map stays where half left it. */
export const mapInset = (position: SheetPosition, heights: SheetHeights): number =>
  position === 'full' ? heights.half : heights[position]
