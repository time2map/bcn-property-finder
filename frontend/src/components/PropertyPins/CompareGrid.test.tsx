import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MantineProvider } from '@mantine/core'
import { ComparePane } from './ComparePane'
import { usePinsStore } from '../../store/pinsStore'
import { useExclusionsStore } from '../../store/exclusionsStore'
import type { PropertyPin } from '../../types/pins'

vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn(), removeItem: vi.fn() })

const makePin = (id: string, overrides: Partial<PropertyPin> = {}): PropertyPin => ({
  id,
  coordinates: [2.17, 41.38],
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

const withAnalytics = (pin: PropertyPin, travelIndex: number): PropertyPin => ({
  ...pin,
  analytics: {
    walkingMinutes: 10,
    publicTransportMinutes: 20,
    cyclingMinutes: 8,
    drivingMinutes: 5,
    travelIndex,
    calculatedAt: '2026-01-01T00:00:00Z',
  },
})

function renderPane() {
  return render(
    <MantineProvider>
      <ComparePane />
    </MantineProvider>,
  )
}

describe('CompareGrid (via ComparePane)', () => {
  beforeEach(() => {
    usePinsStore.setState({ pins: [], selectedPinId: null, isAddingPin: false })
    useExclusionsStore.setState({ zones: [] })
  })

  it('renders nothing when there are no pins', () => {
    renderPane()
    expect(screen.queryByText(/Compare/)).not.toBeInTheDocument()
  })

  it('shows apartment count in the header', () => {
    usePinsStore.setState({ pins: [makePin('a'), makePin('b')], selectedPinId: null, isAddingPin: false })
    renderPane()
    expect(screen.getByText('Compare (2)')).toBeInTheDocument()
  })

  it('renders one column per pin sorted by composite score, best first', () => {
    const pins = [
      withAnalytics(makePin('low'), 30),
      withAnalytics(makePin('high'), 90),
      withAnalytics(makePin('mid'), 55),
    ]
    usePinsStore.setState({ pins, selectedPinId: null, isAddingPin: false })
    renderPane()

    const ranks = screen.getAllByText(/^#[123]$/)
    expect(ranks[0].textContent).toBe('#1')
    expect(ranks[1].textContent).toBe('#2')
    expect(ranks[2].textContent).toBe('#3')
  })

  it('pins without analytics sort last', () => {
    const pins = [makePin('no-data'), withAnalytics(makePin('has-data'), 60)]
    usePinsStore.setState({ pins, selectedPinId: null, isAddingPin: false })
    renderPane()
    const ranks = screen.getAllByText(/^#[12]$/)
    expect(ranks[0].textContent).toBe('#1')
    expect(ranks[1].textContent).toBe('#2')
  })

  it('renders Outdoor and Indoor section bands', () => {
    usePinsStore.setState({ pins: [makePin('a')], selectedPinId: null, isAddingPin: false })
    renderPane()
    expect(screen.getByText('Outdoor — location')).toBeInTheDocument()
    expect(screen.getByText('Indoor — the flat')).toBeInTheDocument()
  })

  it('shows travel time values from analytics', () => {
    usePinsStore.setState({ pins: [withAnalytics(makePin('a'), 80)], selectedPinId: null, isAddingPin: false })
    renderPane()
    expect(screen.getByText('10 min')).toBeInTheDocument() // walking
    expect(screen.getByText('20 min')).toBeInTheDocument() // transit
    expect(screen.getByText('8 min')).toBeInTheDocument()  // cycling
    expect(screen.getByText('5 min')).toBeInTheDocument()  // driving
  })

  it('shows the Location (composite) score in the header card', () => {
    usePinsStore.setState({ pins: [withAnalytics(makePin('a'), 75)], selectedPinId: null, isAddingPin: false })
    renderPane()
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('shows €/m² when both price and area are set', () => {
    usePinsStore.setState({ pins: [makePin('a', { price: 300000, area: 75 })], selectedPinId: null, isAddingPin: false })
    renderPane()
    expect(screen.getByText('€4,000')).toBeInTheDocument() // 300000 / 75
  })

  it('highlights the best value in a comparable row', () => {
    const pins = [
      makePin('a', { price: 300000, area: 75 }), // €4,000 — cheapest €/m²
      makePin('b', { price: 250000, area: 50 }), // €5,000
    ]
    usePinsStore.setState({ pins, selectedPinId: null, isAddingPin: false })
    renderPane()
    expect(screen.getByText('€4,000').closest('td')?.className).toContain('compare-grid__cell--best')
    expect(screen.getByText('€5,000').closest('td')?.className).not.toContain('compare-grid__cell--best')
  })

  it('calls deletePin when a column delete button is clicked', () => {
    const deletePin = vi.fn()
    usePinsStore.setState({ pins: [makePin('a')], selectedPinId: null, isAddingPin: false, deletePin } as never)
    renderPane()
    fireEvent.click(screen.getByLabelText('Delete apartment 1'))
    expect(deletePin).toHaveBeenCalledWith('a')
  })

  it('calls updatePin with price on blur', () => {
    const updatePin = vi.fn()
    usePinsStore.setState({ pins: [makePin('a', { price: 100000 })], selectedPinId: null, isAddingPin: false, updatePin } as never)
    renderPane()
    fireEvent.blur(screen.getByLabelText('Price'), { target: { value: '250000' } })
    expect(updatePin).toHaveBeenCalledWith('a', { price: 250000 })
  })

  it('calls updatePin with area on blur', () => {
    const updatePin = vi.fn()
    usePinsStore.setState({ pins: [makePin('a', { area: 60 })], selectedPinId: null, isAddingPin: false, updatePin } as never)
    renderPane()
    fireEvent.blur(screen.getByLabelText('Area'), { target: { value: '80' } })
    expect(updatePin).toHaveBeenCalledWith('a', { area: 80 })
  })

  it('adds a listing URL via the edit field', () => {
    const updatePin = vi.fn()
    usePinsStore.setState({ pins: [makePin('a')], selectedPinId: null, isAddingPin: false, updatePin } as never)
    renderPane()
    fireEvent.click(screen.getByLabelText('Add listing URL'))
    fireEvent.blur(screen.getByLabelText('Listing URL'), { target: { value: 'https://idealista.com/1' } })
    expect(updatePin).toHaveBeenCalledWith('a', { url: 'https://idealista.com/1' })
  })

  it('removes a listing URL via the options menu', async () => {
    const user = userEvent.setup()
    const updatePin = vi.fn()
    usePinsStore.setState({ pins: [makePin('a', { url: 'https://old.com' })], selectedPinId: null, isAddingPin: false, updatePin } as never)
    renderPane()
    await user.click(screen.getByLabelText('Listing options'))
    await user.click(await screen.findByText('Remove'))
    expect(updatePin).toHaveBeenCalledWith('a', { url: undefined })
  })

  it('sets a 1–10 rating on click', () => {
    const updatePin = vi.fn()
    usePinsStore.setState({ pins: [makePin('a')], selectedPinId: null, isAddingPin: false, updatePin } as never)
    renderPane()
    fireEvent.click(screen.getByLabelText('Rate 7 out of 10'))
    expect(updatePin).toHaveBeenCalledWith('a', { rating: 7 })
  })

  it('calls updatePin with comment on blur', () => {
    const updatePin = vi.fn()
    usePinsStore.setState({ pins: [makePin('a')], selectedPinId: null, isAddingPin: false, updatePin } as never)
    renderPane()
    fireEvent.blur(screen.getByLabelText('Comment'), { target: { value: 'Nice place' } })
    expect(updatePin).toHaveBeenCalledWith('a', { comment: 'Nice place' })
  })

  it('collapses and expands on toggle click', () => {
    usePinsStore.setState({ pins: [makePin('a')], selectedPinId: null, isAddingPin: false })
    renderPane()
    expect(screen.getByLabelText('Price')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /collapse comparison panel/i }))
    expect(screen.queryByLabelText('Price')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /expand comparison panel/i }))
    expect(screen.getByLabelText('Price')).toBeInTheDocument()
  })

  it('shows a single cover photo per column', () => {
    usePinsStore.setState({
      pins: [makePin('a', { photos: ['data:image/jpeg;base64,abc', 'data:image/jpeg;base64,def'] })],
      selectedPinId: null,
      isAddingPin: false,
    })
    renderPane()
    expect(screen.getAllByAltText('Property photo')).toHaveLength(1)
  })

  it('shows add photo button when fewer than 5 photos', () => {
    usePinsStore.setState({
      pins: [makePin('a', { photos: ['data:image/jpeg;base64,abc'] })],
      selectedPinId: null,
      isAddingPin: false,
    })
    renderPane()
    expect(screen.getByLabelText('Add photo')).toBeInTheDocument()
  })

  it('hides add photo button when 5 photos present', () => {
    usePinsStore.setState({
      pins: [makePin('a', { photos: Array(5).fill('data:image/jpeg;base64,abc') })],
      selectedPinId: null,
      isAddingPin: false,
    })
    renderPane()
    expect(screen.queryByLabelText('Add photo')).not.toBeInTheDocument()
  })

  it('flags a pin that falls inside an exclusion zone', () => {
    usePinsStore.setState({ pins: [makePin('a')], selectedPinId: null, isAddingPin: false })
    // Pin sits at [2.17, 41.38]; this zone covers it.
    useExclusionsStore.setState({
      zones: [{
        id: 'z', name: 'No-go', source: 'drawn',
        geometry: { type: 'Polygon', coordinates: [[[2.16, 41.37], [2.18, 41.37], [2.18, 41.39], [2.16, 41.39], [2.16, 41.37]]] },
      }],
    })
    renderPane()
    expect(screen.getByText(/In excluded area/)).toBeInTheDocument()
  })

  it('does not flag a pin outside every exclusion zone', () => {
    usePinsStore.setState({ pins: [makePin('a')], selectedPinId: null, isAddingPin: false })
    useExclusionsStore.setState({
      zones: [{
        id: 'z', name: 'Far', source: 'drawn',
        geometry: { type: 'Polygon', coordinates: [[[2.0, 41.0], [2.01, 41.0], [2.01, 41.01], [2.0, 41.01], [2.0, 41.0]]] },
      }],
    })
    renderPane()
    expect(screen.queryByText(/In excluded area/)).not.toBeInTheDocument()
  })

  it('opens lightbox when a photo thumbnail is clicked', () => {
    usePinsStore.setState({
      pins: [makePin('a', { photos: ['data:image/jpeg;base64,abc'] })],
      selectedPinId: null,
      isAddingPin: false,
    })
    renderPane()
    fireEvent.click(screen.getByAltText('Property photo'))
    expect(screen.getByLabelText('Close')).toBeInTheDocument()
  })
})
