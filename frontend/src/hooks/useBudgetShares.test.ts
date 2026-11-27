import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const data = {
  count: 4,
  meta: { areas: [{ price: 2000 }, { price: 4000 }] },
  cols: { area: Float32Array.from([0, 0, 1, 1]) },
}
const loadScores = vi.fn()

vi.mock('../services/buildings/buildingData', async (importActual) => ({
  ...(await importActual<typeof import('../services/buildings/buildingData')>()),
  loadScores: () => loadScores(),
}))

import { useBudgetShares } from './useBudgetShares'

describe('useBudgetShares', () => {
  beforeEach(() => { loadScores.mockReset() })

  it('is undefined until the data has loaded, then gives the share of homes under a budget', async () => {
    loadScores.mockResolvedValue(data)
    const { result } = renderHook(() => useBudgetShares())
    expect(result.current).toBeUndefined()
    await waitFor(() => expect(result.current).toBeTypeOf('function'))
    expect(result.current!(2000)).toBe(50)
    expect(result.current!(4000)).toBe(100)
  })

  it('stays undefined when the data cannot load', async () => {
    loadScores.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useBudgetShares())
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current).toBeUndefined()
  })

  it('stays undefined when loading throws at once (no fetch in the environment)', () => {
    loadScores.mockImplementation(() => { throw new TypeError('fetch is not defined') })
    const { result } = renderHook(() => useBudgetShares())
    expect(result.current).toBeUndefined()
  })
})
