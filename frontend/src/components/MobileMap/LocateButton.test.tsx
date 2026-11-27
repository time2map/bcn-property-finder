import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import type * as maplibregl from 'maplibre-gl'
import { LocateButton } from './LocateButton'
import { useMapStore } from '../../store/mapStore'
import { useStore } from '../../store'
import type { BuildingData } from '../../services/buildings/buildingData'

vi.mock('maplibre-gl', () => ({
  Marker: class { setLngLat() { return this } addTo() { return this } remove() { return this } },
}))

const DATA = {
  count: 2,
  cols: { lng: Float32Array.from([2.1744, 2.18]), lat: Float32Array.from([41.4036, 41.41]) },
} as unknown as BuildingData

vi.mock('../../hooks/useBuildingData', () => ({ useBuildingData: () => DATA }))

const flyTo = vi.fn()
let geolocation: { getCurrentPosition: ReturnType<typeof vi.fn> }

function position(lng: number, lat: number) {
  geolocation.getCurrentPosition.mockImplementation((ok: (p: unknown) => void) => ok({ coords: { longitude: lng, latitude: lat } }))
}

describe('LocateButton', () => {
  beforeEach(() => {
    flyTo.mockClear()
    useStore.setState({ selectedBuilding: null })
    useMapStore.setState({ map: { flyTo, getZoom: () => 12 } as unknown as maplibregl.Map })
    geolocation = { getCurrentPosition: vi.fn() }
    Object.defineProperty(navigator, 'geolocation', { value: geolocation, configurable: true })
  })

  const tap = () => act(() => { fireEvent.click(screen.getByRole('button', { name: 'Show my location' })) })

  it('flies to the person and opens the home in front of them', () => {
    position(2.17445, 41.40362)
    render(<LocateButton />)
    tap()
    expect(flyTo).toHaveBeenCalledWith({ center: [2.17445, 41.40362], zoom: 17 })
    expect(useStore.getState().selectedBuilding).toBe(0)
  })

  it('only flies when no home is that close', () => {
    position(2.1780, 41.4070)
    render(<LocateButton />)
    tap()
    expect(flyTo).toHaveBeenCalled()
    expect(useStore.getState().selectedBuilding).toBeNull()
  })

  it('says so when the person is outside the map area, and does not move the map', () => {
    position(-3.7, 40.4)
    render(<LocateButton />)
    tap()
    expect(screen.getByRole('status')).toHaveTextContent('You are outside the map area.')
    expect(flyTo).not.toHaveBeenCalled()
  })

  it('explains a blocked permission', () => {
    geolocation.getCurrentPosition.mockImplementation((_ok: unknown, fail: (e: unknown) => void) =>
      fail({ code: 1, PERMISSION_DENIED: 1 }))
    render(<LocateButton />)
    tap()
    expect(screen.getByRole('status')).toHaveTextContent('Location is blocked')
  })

  it('explains a failed lookup', () => {
    geolocation.getCurrentPosition.mockImplementation((_ok: unknown, fail: (e: unknown) => void) =>
      fail({ code: 2, PERMISSION_DENIED: 1 }))
    render(<LocateButton />)
    tap()
    expect(screen.getByRole('status')).toHaveTextContent('Could not find your position')
  })
})
