import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { clampWidth, maxWidth, MIN_WIDTH, useSplitPane } from './useSplitPane'

describe('clampWidth', () => {
  it('floors at MIN_WIDTH', () => {
    expect(clampWidth(100, 1000)).toBe(MIN_WIDTH)
  })

  it('caps at the provided max', () => {
    expect(clampWidth(5000, 800)).toBe(800)
  })

  it('passes values within range unchanged', () => {
    expect(clampWidth(500, 1000)).toBe(500)
  })
})

describe('maxWidth', () => {
  it('is 60% of the viewport', () => {
    expect(maxWidth(1000)).toBe(600)
  })

  it('never drops below MIN_WIDTH on tiny viewports', () => {
    expect(maxWidth(100)).toBe(MIN_WIDTH)
  })
})

describe('useSplitPane', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    })
  })

  it('persists collapsed state on toggle', () => {
    const { result } = renderHook(() => useSplitPane())
    expect(result.current.collapsed).toBe(false)

    act(() => result.current.toggleCollapsed())
    expect(result.current.collapsed).toBe(true)
    expect(localStorage.getItem('bcn_compare_collapsed')).toBe('true')

    act(() => result.current.setCollapsed(false))
    expect(result.current.collapsed).toBe(false)
    expect(localStorage.getItem('bcn_compare_collapsed')).toBe('false')
  })
})
