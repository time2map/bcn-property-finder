import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const state = vi.hoisted(() => ({ data: null as unknown, load: vi.fn() }))
vi.mock('../services/buildings/buildingData', () => ({
  get buildingData() { return state.data },
  loadBuildings: state.load,
}))

import { useBuildingData } from './useBuildingData'

describe('useBuildingData (058)', () => {
  beforeEach(() => { state.data = null; state.load.mockReset() })

  it('gives the loaded data at once and asks for nothing', () => {
    state.data = { count: 1 }
    const { result } = renderHook(() => useBuildingData(true))
    expect(result.current).toEqual({ count: 1 })
    expect(state.load).not.toHaveBeenCalled()
  })

  it('loads the data when wanted and gives it once it is there', async () => {
    const data = { count: 2 }
    state.load.mockResolvedValue(data)
    const { result, rerender } = renderHook(({ wanted }) => useBuildingData(wanted), { initialProps: { wanted: false } })
    expect(state.load).not.toHaveBeenCalled()
    expect(result.current).toBeNull()
    rerender({ wanted: true })
    await waitFor(() => expect(result.current).toBe(data))
    expect(state.load).toHaveBeenCalledTimes(1)
  })

  it('stays empty when the data cannot load', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    state.load.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useBuildingData(true))
    await waitFor(() => expect(error).toHaveBeenCalled())
    expect(result.current).toBeNull()
    error.mockRestore()
  })
})
