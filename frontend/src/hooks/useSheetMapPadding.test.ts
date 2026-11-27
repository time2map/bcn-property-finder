import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import type * as maplibregl from 'maplibre-gl'
import { useSheetMapPadding } from './useSheetMapPadding'
import { useMapStore } from '../store/mapStore'
import { useSheetStore } from '../store/sheetStore'

function fakeMap() {
  let bottom = 0
  return {
    getPadding: () => ({ top: 0, left: 0, right: 0, bottom }),
    easeTo: vi.fn((o: { padding: { bottom: number } }) => { bottom = o.padding.bottom }),
    setPadding: vi.fn((p: { bottom: number }) => { bottom = p.bottom }),
  }
}

describe('useSheetMapPadding', () => {
  beforeEach(() => useSheetStore.setState({ mapInset: 104 }))

  it('applies the inset at once the first time, then eases to the next one', () => {
    const map = fakeMap()
    useMapStore.setState({ map: map as unknown as maplibregl.Map })
    renderHook(() => useSheetMapPadding(true))
    expect(map.easeTo).toHaveBeenCalledWith({ padding: { top: 0, left: 0, right: 0, bottom: 104 }, duration: 0 })
    act(() => useSheetStore.getState().setMapInset(332))
    expect(map.easeTo).toHaveBeenLastCalledWith({ padding: { top: 0, left: 0, right: 0, bottom: 332 }, duration: 250 })
  })

  it('does not move the map when the inset has not changed', () => {
    const map = fakeMap()
    useMapStore.setState({ map: map as unknown as maplibregl.Map })
    renderHook(() => useSheetMapPadding(true))
    map.easeTo.mockClear()
    act(() => useSheetStore.getState().setMapInset(104))
    expect(map.easeTo).not.toHaveBeenCalled()
  })

  it('gives the whole map back when the layout leaves the phone', () => {
    const map = fakeMap()
    useMapStore.setState({ map: map as unknown as maplibregl.Map })
    const { unmount } = renderHook(() => useSheetMapPadding(true))
    unmount()
    expect(map.setPadding).toHaveBeenLastCalledWith({ top: 0, left: 0, right: 0, bottom: 0 })
  })

  it('does nothing when disabled', () => {
    const map = fakeMap()
    useMapStore.setState({ map: map as unknown as maplibregl.Map })
    renderHook(() => useSheetMapPadding(false))
    expect(map.easeTo).not.toHaveBeenCalled()
  })
})
