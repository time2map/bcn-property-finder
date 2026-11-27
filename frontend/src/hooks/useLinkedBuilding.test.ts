import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'

vi.mock('./useBuildingData', () => ({
  useBuildingData: () => ({ cols: { lng: new Float32Array([2.1, 2.17401]), lat: new Float32Array([41.4, 41.40301]) } }),
}))

import { useStore } from '../store'
import { useLinkedBuilding } from './useLinkedBuilding'

describe('useLinkedBuilding (TODO-064)', () => {
  beforeEach(() => useStore.getState().setSelectedBuilding(null))
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('selects the building named in b', () => {
    window.history.replaceState(null, '', '/?b=2.17401,41.40301')
    renderHook(() => useLinkedBuilding())
    expect(useStore.getState().selectedBuilding).toBe(1)
  })
  it('does nothing without b', () => {
    renderHook(() => useLinkedBuilding())
    expect(useStore.getState().selectedBuilding).toBeNull()
  })
  it('does nothing when no building is near', () => {
    window.history.replaceState(null, '', '/?b=2.5,41.9')
    renderHook(() => useLinkedBuilding())
    expect(useStore.getState().selectedBuilding).toBeNull()
  })
})
