/** Phone layout settings (TODO-062). Defaults live in .env.local.example / .env.production. */
/** "Locate me" opens the nearest home only if it is this close (metres). */
export const LOCATE_NEAREST_BUILDING_M = Number(import.meta.env.VITE_LOCATE_NEAREST_BUILDING_M ?? 40)
/** A tap on a touch screen picks the nearest home within this distance of the finger (pixels). */
export const TAP_TOLERANCE_PX = Number(import.meta.env.VITE_TAP_TOLERANCE_PX ?? 8)
/** Widest screen that gets the phone layout. */
export const PHONE_MAX_WIDTH = 768
export const PHONE_QUERY = `(max-width: ${PHONE_MAX_WIDTH}px)`
/**
 * On a touch screen a tap on a home waits this long (ms) before it opens the card: a second touch within it is the
 * start of a double-tap zoom, not a pick. Mouse clicks are not delayed.
 */
export const DOUBLE_TAP_GRACE_MS = Number(import.meta.env.VITE_DOUBLE_TAP_GRACE_MS ?? 280)
