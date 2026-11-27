import { describe, it, expect, beforeEach } from 'vitest'
import { useSheetStore } from './sheetStore'

const reset = () => useSheetStore.setState({ position: 'peek', mapInset: 0, tab: 'settings', pickedArea: null, restore: null })

describe('sheetStore', () => {
  beforeEach(reset)

  it('drops to peek and remembers the area when one is picked from the list', () => {
    useSheetStore.setState({ position: 'half', tab: 'areas' })
    useSheetStore.getState().pickArea({ name: 'Verdun', share: 100 })
    expect(useSheetStore.getState()).toMatchObject({ position: 'peek', pickedArea: { name: 'Verdun', share: 100 } })
  })

  it('forgets the picked area as soon as the sheet opens further', () => {
    useSheetStore.getState().pickArea({ name: 'Verdun', share: 100 })
    useSheetStore.getState().setPosition('half')
    expect(useSheetStore.getState().pickedArea).toBeNull()
  })

  it('keeps the picked area while the sheet stays at peek', () => {
    useSheetStore.getState().pickArea({ name: 'Verdun', share: 100 })
    useSheetStore.getState().setPosition('peek')
    expect(useSheetStore.getState().pickedArea).not.toBeNull()
  })

  it('"Back to the list" opens the list at half', () => {
    useSheetStore.getState().pickArea({ name: 'Verdun', share: 100 })
    useSheetStore.getState().backToList()
    expect(useSheetStore.getState()).toMatchObject({ position: 'half', tab: 'areas', pickedArea: null })
  })

  it('shows a building at peek and returns to the previous position on close', () => {
    useSheetStore.setState({ position: 'half' })
    useSheetStore.getState().openBuilding()
    expect(useSheetStore.getState().position).toBe('peek')
    useSheetStore.getState().closeBuilding()
    expect(useSheetStore.getState()).toMatchObject({ position: 'half', restore: null })
  })

  it('keeps the first way back when a second building is opened', () => {
    useSheetStore.setState({ position: 'half' })
    useSheetStore.getState().openBuilding()
    useSheetStore.getState().setPosition('full')
    useSheetStore.getState().openBuilding() // another building: the first one set the way back
    expect(useSheetStore.getState().restore).toBe('half')
    useSheetStore.getState().closeBuilding()
    expect(useSheetStore.getState().position).toBe('half')
  })
})
