import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSheetFlow } from './useSheetFlow'
import { useStore } from '../store'
import { useSheetStore } from '../store/sheetStore'

const select = (row: number | null) => act(() => { useStore.getState().setSelectedBuilding(row) })

describe('useSheetFlow', () => {
  beforeEach(() => {
    useStore.setState({ selectedBuilding: null })
    useSheetStore.setState({ position: 'half', restore: null, pickedArea: null, tab: 'settings', mapInset: 0 })
  })

  it('opens a building at peek and brings the old position back on close', () => {
    renderHook(() => useSheetFlow(true))
    select(5)
    expect(useSheetStore.getState().position).toBe('peek')
    select(null)
    expect(useSheetStore.getState().position).toBe('half')
  })

  it('keeps the position when another building is picked', () => {
    renderHook(() => useSheetFlow(true))
    select(5)
    act(() => useSheetStore.getState().setPosition('full'))
    select(8)
    expect(useSheetStore.getState().position).toBe('full')
    select(null)
    expect(useSheetStore.getState().position).toBe('half')
  })

  it('does nothing off the phone layout', () => {
    renderHook(() => useSheetFlow(false))
    select(5)
    expect(useSheetStore.getState().position).toBe('half')
  })
})
