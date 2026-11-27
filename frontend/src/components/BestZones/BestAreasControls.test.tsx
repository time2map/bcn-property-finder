import { describe, it, expect, beforeEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import { BestAreasControls } from './BestAreasControls'
import { useStore } from '../../store'
import { useMapStore } from '../../store/mapStore'
import { renderWithMantine } from '../Conditions/testUtils'

/** A 1000×500 px map showing [2.0, 41.2, 2.4, 41.6]; unproject maps pixels to degrees. */
const fakeMap = {
  getContainer: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 500 }) }),
  unproject: ([x, y]: [number, number]) => ({ lng: 2.0 + (0.4 * x) / 1000, lat: 41.6 - (0.4 * y) / 500 }),
}

describe('BestAreasControls (TODO-052)', () => {
  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = ''
    useMapStore.setState({ map: fakeMap as never })
    useStore.setState({ compositeVisible: true, bestZonesBounds: null, bestZonesTopPct: 15, bestZonesCount: null, bestZonesRestrict: true })
  })

  it('one button to start: "Show my best areas" draws the zones for what is in view', () => {
    renderWithMantine(<BestAreasControls />)
    expect(screen.queryByRole('button', { name: 'More areas' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show my best areas' }))
    expect(useStore.getState().bestZonesBounds).toEqual([2.0, 41.2, 2.4, 41.6])
  })

  it('the button waits for the map', () => {
    useMapStore.setState({ map: null })
    renderWithMantine(<BestAreasControls />)
    expect((screen.getByRole('button', { name: 'Show my best areas' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('once on: how many areas, More / Fewer step through the strictness, Hide clears', () => {
    act(() => useStore.setState({ bestZonesBounds: [2, 41.2, 2.4, 41.6], bestZonesCount: 3 }))
    renderWithMantine(<BestAreasControls />)
    expect(screen.getByText('3 best areas in view')).toBeTruthy()
    expect(screen.getByText('Top 15% of homes, numbered on the map.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'More areas' }))
    expect(useStore.getState().bestZonesTopPct).toBe(20)
    fireEvent.click(screen.getByRole('button', { name: 'Fewer areas' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fewer areas' }))
    expect(useStore.getState().bestZonesTopPct).toBe(10)
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }))
    expect(useStore.getState().bestZonesBounds).toBeNull()
    expect(screen.getByRole('button', { name: 'Show my best areas' })).toBeTruthy()
  })

  it('the ends of the scale are disabled', () => {
    act(() => useStore.setState({ bestZonesBounds: [2, 41.2, 2.4, 41.6], bestZonesTopPct: 25 }))
    const { unmount } = renderWithMantine(<BestAreasControls />)
    expect((screen.getByRole('button', { name: 'More areas' }) as HTMLButtonElement).disabled).toBe(true)
    unmount()
    act(() => useStore.setState({ bestZonesTopPct: 5 }))
    renderWithMantine(<BestAreasControls />)
    expect((screen.getByRole('button', { name: 'Fewer areas' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('says so when no area fits, and uses the singular for one', () => {
    act(() => useStore.setState({ bestZonesBounds: [2, 41.2, 2.4, 41.6], bestZonesCount: 0 }))
    const { unmount } = renderWithMantine(<BestAreasControls />)
    expect(screen.getByText('No area fits this view. Zoom out or ask for more areas.')).toBeTruthy()
    unmount()
    act(() => useStore.setState({ bestZonesCount: 1 }))
    renderWithMantine(<BestAreasControls />)
    expect(screen.getByText('1 best area in view')).toBeTruthy()
  })

  it('opens the search filters (the Idealista search to reuse) in a popover', () => {
    act(() => useStore.setState({ bestZonesBounds: [2, 41.2, 2.4, 41.6] }))
    renderWithMantine(<BestAreasControls />)
    expect(screen.queryByText(/Zone links reuse the filters/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Search filters' }))
    expect(screen.getByText(/Zone links reuse the filters/)).toBeTruthy()
  })

  it('has the commute-zone option while a commute or exclusion feature is on', () => {
    act(() => useStore.setState({ bestZonesBounds: [2, 41.2, 2.4, 41.6] }))
    renderWithMantine(<BestAreasControls />)
    const box = screen.getByLabelText('Inside commute zone, outside exclusion zones') as HTMLInputElement
    expect(box.checked).toBe(true)
    fireEvent.click(box)
    expect(useStore.getState().bestZonesRestrict).toBe(false)
  })

  it('needs the match colours: without them it says so', () => {
    act(() => useStore.setState({ compositeVisible: false }))
    renderWithMantine(<BestAreasControls />)
    expect(screen.getByText('Turn on the match colours to see your best areas.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Show my best areas' })).toBeNull()
  })
})
