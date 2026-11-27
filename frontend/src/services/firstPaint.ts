// Heavy start-up work waits for the first paint (TODO-058): loading and unpacking the scores, parsing the base map
// style (preloaded by index.html, so it can be there before React has drawn anything) and setting up the map.
// Started earlier, they run first and hold the first paint back.

/** A tab in the background draws no frames: the work then starts after this pause. */
const NO_FRAME_FALLBACK_MS = 300

let promise: Promise<void> | null = null

/**
 * Resolves in the task after the next frame is drawn: the frame with React's first render when called at start
 * (from main.tsx or from an effect of the first render). Later calls get the same, resolved promise. Where there
 * are no frames (a background tab, tests) it resolves at once or after a short pause.
 *
 * Not the browser's own paint report (PerformanceObserver): that arrives 100–250 ms after the paint.
 */
export function afterFirstPaint(): Promise<void> {
  promise ??= new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame !== 'function' || document.visibilityState === 'hidden') {
      resolve()
      return
    }
    const fallback = setTimeout(resolve, NO_FRAME_FALLBACK_MS)
    requestAnimationFrame(() => {
      // The frame callback runs before the paint, a task queued from it runs after.
      setTimeout(() => {
        clearTimeout(fallback)
        resolve()
      }, 0)
    })
  })
  return promise
}

export function resetFirstPaint(): void {
  promise = null
}
