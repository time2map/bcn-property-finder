import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { afterFirstPaint, resetFirstPaint } from './firstPaint'

function setVisibility(value: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value, configurable: true })
}

async function settled(p: Promise<void>): Promise<boolean> {
  let done = false
  void p.then(() => { done = true })
  await Promise.resolve()
  await Promise.resolve()
  return done
}

describe('afterFirstPaint', () => {
  let frames: FrameRequestCallback[]

  beforeEach(() => {
    resetFirstPaint()
    setVisibility('visible')
    vi.useFakeTimers()
    frames = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb))
  })
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); setVisibility('visible') })

  it('resolves in the task after the next frame, not in the frame callback (which runs before the paint)', async () => {
    const p = afterFirstPaint()
    expect(await settled(p)).toBe(false)
    frames[0](0)
    expect(await settled(p)).toBe(false)
    vi.advanceTimersByTime(0)
    expect(await settled(p)).toBe(true)
  })

  it('is the same promise for every caller, resolved at once after the paint', async () => {
    const first = afterFirstPaint()
    expect(afterFirstPaint()).toBe(first)
    frames[0](0)
    vi.advanceTimersByTime(0)
    expect(await settled(afterFirstPaint())).toBe(true)
    expect(frames).toHaveLength(1)
  })

  it('does not wait in a background tab or where there are no frames at all', async () => {
    setVisibility('hidden')
    expect(await settled(afterFirstPaint())).toBe(true)
    expect(frames).toHaveLength(0)
    resetFirstPaint()
    setVisibility('visible')
    vi.stubGlobal('requestAnimationFrame', undefined)
    expect(await settled(afterFirstPaint())).toBe(true)
  })

  it('gives up waiting when no frame comes (the tab went to the background)', async () => {
    const p = afterFirstPaint()
    vi.advanceTimersByTime(299)
    expect(await settled(p)).toBe(false)
    vi.advanceTimersByTime(1)
    expect(await settled(p)).toBe(true)
  })
})
