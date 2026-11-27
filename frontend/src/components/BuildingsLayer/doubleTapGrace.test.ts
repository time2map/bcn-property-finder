import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { commitAfterGrace } from './doubleTapGrace'

function fakeMap() {
  const handlers = new Map<string, Set<() => void>>()
  return {
    on: vi.fn((e: string, h: () => void) => { (handlers.get(e) ?? handlers.set(e, new Set()).get(e)!).add(h) }),
    off: vi.fn((e: string, h: () => void) => { handlers.get(e)?.delete(h) }),
    emit: (e: string) => handlers.get(e)?.forEach((h) => h()),
    count: () => [...handlers.values()].reduce((n, s) => n + s.size, 0),
  }
}

describe('commitAfterGrace', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('commits once the pause has passed', () => {
    const map = fakeMap()
    const commit = vi.fn()
    commitAfterGrace(map as never, 280, commit)
    vi.advanceTimersByTime(279)
    expect(commit).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(commit).toHaveBeenCalledTimes(1)
    expect(map.count()).toBe(0) // listeners removed
  })

  it('does not commit when a second touch starts (double-tap zoom)', () => {
    const map = fakeMap()
    const commit = vi.fn()
    commitAfterGrace(map as never, 280, commit)
    vi.advanceTimersByTime(150)
    map.emit('touchstart')
    vi.advanceTimersByTime(1000)
    expect(commit).not.toHaveBeenCalled()
    expect(map.count()).toBe(0)
  })

  it('does not commit when the map starts moving or zooming', () => {
    for (const e of ['movestart', 'zoomstart']) {
      const map = fakeMap()
      const commit = vi.fn()
      commitAfterGrace(map as never, 280, commit)
      map.emit(e)
      vi.advanceTimersByTime(1000)
      expect(commit).not.toHaveBeenCalled()
    }
  })

  it('can be cancelled by the caller', () => {
    const map = fakeMap()
    const commit = vi.fn()
    const cancel = commitAfterGrace(map as never, 280, commit)
    cancel()
    vi.advanceTimersByTime(1000)
    expect(commit).not.toHaveBeenCalled()
  })
})
