import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

const loadAreaJoin = vi.fn()
vi.mock('../services/areas/areaJoinLoader', () => ({ loadAreaJoin: () => loadAreaJoin() }))

import { useAreaJoin } from './useAreaJoin'

describe('useAreaJoin', () => {
  it('is null until the join is ready, then the map', async () => {
    const join = new Map([[0, {}]])
    loadAreaJoin.mockResolvedValue(join)
    const { result } = renderHook(() => useAreaJoin())
    expect(result.current).toBeNull()
    await waitFor(() => expect(result.current).toBe(join))
  })

  it('stays null when loading fails', async () => {
    loadAreaJoin.mockRejectedValue(new Error('offline'))
    const { result } = renderHook(() => useAreaJoin())
    await new Promise((r) => setTimeout(r, 0))
    expect(result.current).toBeNull()
  })
})
