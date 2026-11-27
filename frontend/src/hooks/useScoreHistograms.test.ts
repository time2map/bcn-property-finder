import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useStore } from '../store'

const DATA = {
  meta: { areas: [{ code: '01', name: 'el Raval', kind: 'barri', price: null }] },
  count: 3, cols: { area: Float32Array.from([0, 0, NaN]) },
}
vi.mock('./useBuildingData', () => ({ useBuildingData: () => DATA }))

import { useScoreHistograms } from './useScoreHistograms'

describe('useScoreHistograms (TODO-070)', () => {
  beforeEach(() => useStore.setState({ buildingScores: null }))

  it('is null until the scores are in, then counts them per area and overall', () => {
    const { result } = renderHook(() => useScoreHistograms())
    expect(result.current).toBeNull()
    act(() => useStore.getState().setBuildingScores(Uint8Array.from([40, 40, 90])))
    expect(result.current!.areas[0][40]).toBe(2)
    expect(result.current!.all[90]).toBe(1)
    expect(result.current!.barcelona[90]).toBe(0)
  })

  it('is rebuilt after a rescoring', () => {
    act(() => useStore.getState().setBuildingScores(Uint8Array.from([40, 40, 90])))
    const { result } = renderHook(() => useScoreHistograms())
    const first = result.current
    act(() => useStore.getState().setBuildingScores(Uint8Array.from([10, 10, 10])))
    expect(result.current).not.toBe(first)
    expect(result.current!.areas[0][10]).toBe(2)
  })
})
