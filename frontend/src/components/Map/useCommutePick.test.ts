import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStore } from '../../store'
import { useCommutePick } from './useCommutePick'

function fakeMap() {
  const canvas = { style: { cursor: '' } }
  return { canvas, on: vi.fn(), off: vi.fn(), getCanvas: () => canvas }
}
const clickOf = (map: ReturnType<typeof fakeMap>) =>
  map.on.mock.calls.filter(([e]) => e === 'click').at(-1)![1] as (e: unknown) => void

describe('useCommutePick (078)', () => {
  beforeEach(() => useStore.setState({ workplace: null, commutePicking: false }))

  it('does nothing until picking is asked for', () => {
    const map = fakeMap()
    renderHook(() => useCommutePick(map as never))
    expect(map.on).not.toHaveBeenCalled()
  })

  it('while picking: crosshair, and the next click sets the place and ends picking', async () => {
    vi.useFakeTimers()
    try {
      const map = fakeMap()
      useStore.setState({ commutePicking: true })
      renderHook(() => useCommutePick(map as never))
      expect(map.canvas.style.cursor).toBe('crosshair')
      act(() => clickOf(map)({ lngLat: { lng: 2.15, lat: 41.4 } }))
      expect(useStore.getState().workplace).toEqual([2.15, 41.4])
      // the buildings and areas see the flag during this click: they don't open a card or fly away
      expect(useStore.getState().commutePicking).toBe(true)
      await act(async () => { vi.runAllTimers() })
      expect(useStore.getState().commutePicking).toBe(false)
      expect(map.off).toHaveBeenCalledWith('click', expect.any(Function))
      expect(map.canvas.style.cursor).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })

  it('Esc cancels picking and keeps the place', () => {
    const map = fakeMap()
    useStore.setState({ commutePicking: true, workplace: [2.17, 41.387] })
    renderHook(() => useCommutePick(map as never))
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(useStore.getState().commutePicking).toBe(false)
    expect(useStore.getState().workplace).toEqual([2.17, 41.387])
  })
})
