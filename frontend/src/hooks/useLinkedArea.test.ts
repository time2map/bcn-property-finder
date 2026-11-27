import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { AreaFeature } from '../services/areas'

const feature: AreaFeature = {
  type: 'Feature', properties: { id: 'barri-0131', name: 'la Vila de Gràcia', kind: 'barri' },
  geometry: { type: 'Polygon', coordinates: [[[2.15, 41.4], [2.17, 41.4], [2.17, 41.42], [2.15, 41.42], [2.15, 41.4]]] },
}
vi.mock('./useAreaJoin', () => ({ useAreaJoin: () => new Map([[3, feature]]) }))

import { useStore } from '../store'
import { useSearchStore } from '../store/searchStore'
import { useLinkedArea } from './useLinkedArea'

const ranks = [{ index: 3, code: '31', name: 'la Vila de Gràcia', kind: 'barri' }] as never

describe('useLinkedArea (TODO-064)', () => {
  beforeEach(() => {
    useStore.setState({ areaRanks: ranks, selectedArea: null })
    useSearchStore.setState({ selection: null })
  })
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('opens the card of the area named in a and outlines it', () => {
    window.history.replaceState(null, '', '/?a=31')
    renderHook(() => useLinkedArea())
    expect(useStore.getState().selectedArea).toBe(3)
    expect(useSearchStore.getState().selection?.kind).toBe('area')
  })
  it('does nothing without a, or for an unknown code', () => {
    renderHook(() => useLinkedArea())
    window.history.replaceState(null, '', '/?a=99')
    renderHook(() => useLinkedArea())
    expect(useStore.getState().selectedArea).toBeNull()
  })
  it('waits for the ranks', () => {
    useStore.setState({ areaRanks: null })
    window.history.replaceState(null, '', '/?a=31')
    const { rerender } = renderHook(() => useLinkedArea())
    expect(useStore.getState().selectedArea).toBeNull()
    useStore.setState({ areaRanks: ranks })
    rerender()
    expect(useStore.getState().selectedArea).toBe(3)
  })
})
