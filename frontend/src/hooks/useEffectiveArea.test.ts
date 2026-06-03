import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { Polygon } from 'geojson'
import { useEffectiveArea } from './useEffectiveArea'
import { useStore } from '../store'
import { useExclusionsStore } from '../store/exclusionsStore'

const BASE: Polygon = {
  type: 'Polygon',
  coordinates: [[[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]],
}
const INTERIOR: Polygon = {
  type: 'Polygon',
  coordinates: [[[3, 3], [5, 3], [5, 5], [3, 5], [3, 3]]],
}

describe('useEffectiveArea', () => {
  beforeEach(() => {
    useStore.setState({ resultPolygon: null })
    useExclusionsStore.setState({ zones: [] })
  })

  it('returns null when there is no result polygon', () => {
    const { result } = renderHook(() => useEffectiveArea())
    expect(result.current).toBeNull()
  })

  it('returns the result polygon unchanged when there are no zones', () => {
    useStore.setState({ resultPolygon: BASE })
    const { result } = renderHook(() => useEffectiveArea())
    expect(result.current).toEqual(BASE)
  })

  it('subtracts an exclusion zone, creating a hole', () => {
    useStore.setState({ resultPolygon: BASE })
    useExclusionsStore.setState({
      zones: [{ id: '1', name: 'z', source: 'drawn', geometry: INTERIOR }],
    })
    const { result } = renderHook(() => useEffectiveArea())
    expect(result.current).not.toBeNull()
    expect((result.current as Polygon).coordinates).toHaveLength(2)
  })
})
