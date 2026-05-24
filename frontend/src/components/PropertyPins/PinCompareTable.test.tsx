import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { PinCompareTable } from './PinCompareTable'
import { usePinsStore } from '../../store/pinsStore'
import type { PropertyPin } from '../../types/pins'

vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() })

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

function renderTable() {
  return render(
    <MantineProvider>
      <PinCompareTable />
    </MantineProvider>,
  )
}

describe('PinCompareTable', () => {
  beforeEach(() => {
    usePinsStore.setState({ pins: [], selectedPinId: null, isAddingPin: false })
  })

  it('renders nothing when there are no pins', () => {
    renderTable()
    expect(screen.queryByText(/Apartments/)).not.toBeInTheDocument()
  })

  it('shows apartment count in header', () => {
    usePinsStore.setState({ pins: [makePin('a'), makePin('b')], selectedPinId: null, isAddingPin: false })
    renderTable()
    expect(screen.getByText('Apartments (2)')).toBeInTheDocument()
  })

  it('renders one row per pin sorted by travelIndex descending', () => {
    const pins = [
      withAnalytics(makePin('low'), 30),
      withAnalytics(makePin('high'), 90),
      withAnalytics(makePin('mid'), 55),
    ]
    usePinsStore.setState({ pins, selectedPinId: null, isAddingPin: false })
    renderTable()

    const ranks = screen.getAllByText(/^#[123]$/)
    expect(ranks[0].textContent).toBe('#1')
    expect(ranks[1].textContent).toBe('#2')
    expect(ranks[2].textContent).toBe('#3')
  })

  it('pins without analytics appear last', () => {
    const pins = [makePin('no-data'), withAnalytics(makePin('has-data'), 60)]
    usePinsStore.setState({ pins, selectedPinId: null, isAddingPin: false })
    renderTable()
    const ranks = screen.getAllByText(/^#[12]$/)
    expect(ranks[0].textContent).toBe('#1')
    expect(ranks[1].textContent).toBe('#2')
  })

  it('shows travel time values from analytics', () => {
    usePinsStore.setState({
      pins: [withAnalytics(makePin('a'), 80)],
      selectedPinId: null,
      isAddingPin: false,
    })
    renderTable()
    expect(screen.getByText('10 min')).toBeInTheDocument() // walking
    expect(screen.getByText('20 min')).toBeInTheDocument() // transit
    expect(screen.getByText('8 min')).toBeInTheDocument()  // cycling
    expect(screen.getByText('5 min')).toBeInTheDocument()  // driving
  })

  it('shows score badge', () => {
    usePinsStore.setState({
      pins: [withAnalytics(makePin('a'), 75)],
      selectedPinId: null,
      isAddingPin: false,
    })
    renderTable()
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('shows price/m² when both price and area are set', () => {
    usePinsStore.setState({
      pins: [makePin('a', { price: 300000, area: 75 })],
      selectedPinId: null,
      isAddingPin: false,
    })
    renderTable()
    // 300000 / 75 = 4000
    expect(screen.getByText('€4,000')).toBeInTheDocument()
  })

  it('calls deletePin when delete button is clicked', () => {
    const deletePin = vi.fn()
    usePinsStore.setState({
      pins: [makePin('a')],
      selectedPinId: null,
      isAddingPin: false,
      deletePin,
    } as never)
    renderTable()
    fireEvent.click(screen.getByLabelText('Delete apartment 1'))
    expect(deletePin).toHaveBeenCalledWith('a')
  })

  it('calls updatePin with price on blur', () => {
    const updatePin = vi.fn()
    usePinsStore.setState({
      pins: [makePin('a', { price: 100000 })],
      selectedPinId: null,
      isAddingPin: false,
      updatePin,
    } as never)
    renderTable()
    const input = screen.getByLabelText('Price')
    fireEvent.blur(input, { target: { value: '250000' } })
    expect(updatePin).toHaveBeenCalledWith('a', { price: 250000 })
  })

  it('calls updatePin with area on blur', () => {
    const updatePin = vi.fn()
    usePinsStore.setState({
      pins: [makePin('a', { area: 60 })],
      selectedPinId: null,
      isAddingPin: false,
      updatePin,
    } as never)
    renderTable()
    const input = screen.getByLabelText('Area')
    fireEvent.blur(input, { target: { value: '80' } })
    expect(updatePin).toHaveBeenCalledWith('a', { area: 80 })
  })

  it('calls updatePin with url on blur', () => {
    const updatePin = vi.fn()
    usePinsStore.setState({
      pins: [makePin('a')],
      selectedPinId: null,
      isAddingPin: false,
      updatePin,
    } as never)
    renderTable()
    const input = screen.getByLabelText('Listing URL')
    fireEvent.blur(input, { target: { value: 'https://idealista.com/1' } })
    expect(updatePin).toHaveBeenCalledWith('a', { url: 'https://idealista.com/1' })
  })

  it('calls updatePin with undefined url when cleared', () => {
    const updatePin = vi.fn()
    usePinsStore.setState({
      pins: [makePin('a', { url: 'https://old.com' })],
      selectedPinId: null,
      isAddingPin: false,
      updatePin,
    } as never)
    renderTable()
    const input = screen.getByLabelText('Listing URL')
    fireEvent.blur(input, { target: { value: '' } })
    expect(updatePin).toHaveBeenCalledWith('a', { url: undefined })
  })

  it('calls updatePin with comment on blur', () => {
    const updatePin = vi.fn()
    usePinsStore.setState({
      pins: [makePin('a')],
      selectedPinId: null,
      isAddingPin: false,
      updatePin,
    } as never)
    renderTable()
    const textarea = screen.getByLabelText('Comment')
    fireEvent.blur(textarea, { target: { value: 'Nice place' } })
    expect(updatePin).toHaveBeenCalledWith('a', { comment: 'Nice place' })
  })

  it('collapses and expands on toggle click', () => {
    usePinsStore.setState({ pins: [makePin('a')], selectedPinId: null, isAddingPin: false })
    renderTable()
    expect(screen.getByLabelText('Price')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /collapse/i }))
    expect(screen.queryByLabelText('Price')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /expand/i }))
    expect(screen.getByLabelText('Price')).toBeInTheDocument()
  })

  it('shows photo thumbnails', () => {
    usePinsStore.setState({
      pins: [makePin('a', { photos: ['data:image/jpeg;base64,abc', 'data:image/jpeg;base64,def'] })],
      selectedPinId: null,
      isAddingPin: false,
    })
    renderTable()
    const imgs = screen.getAllByAltText('Property photo')
    expect(imgs).toHaveLength(2)
  })

  it('shows add photo button when fewer than 5 photos', () => {
    usePinsStore.setState({
      pins: [makePin('a', { photos: ['data:image/jpeg;base64,abc'] })],
      selectedPinId: null,
      isAddingPin: false,
    })
    renderTable()
    expect(screen.getByLabelText('Add photo')).toBeInTheDocument()
  })

  it('hides add photo button when 5 photos present', () => {
    const photos = Array(5).fill('data:image/jpeg;base64,abc')
    usePinsStore.setState({
      pins: [makePin('a', { photos })],
      selectedPinId: null,
      isAddingPin: false,
    })
    renderTable()
    expect(screen.queryByLabelText('Add photo')).not.toBeInTheDocument()
  })

  it('opens lightbox when photo thumbnail is clicked', () => {
    usePinsStore.setState({
      pins: [makePin('a', { photos: ['data:image/jpeg;base64,abc'] })],
      selectedPinId: null,
      isAddingPin: false,
    })
    renderTable()
    fireEvent.click(screen.getByAltText('Property photo'))
    // Lightbox renders a close button
    expect(screen.getByLabelText('Close')).toBeInTheDocument()
  })
})
