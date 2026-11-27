import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { SearchBox } from './SearchBox'
import { useSearchStore } from '../../store/searchStore'
import type { AreaFeature } from '../../services/areas'

const areas: AreaFeature[] = [
  {
    type: 'Feature',
    properties: { id: 'barri-0631', name: 'la Vila de Gràcia', kind: 'barri' },
    geometry: { type: 'Polygon', coordinates: [[[2.15, 41.4], [2.16, 41.4], [2.16, 41.41], [2.15, 41.41], [2.15, 41.4]]] },
  },
]

vi.mock('../../services/areas', async () => {
  const actual = await vi.importActual<typeof import('../../services/areas')>('../../services/areas')
  return { ...actual, loadAreas: vi.fn(async () => areas) }
})

const searchAddresses = vi.fn()
vi.mock('../../services/geocoding', () => ({
  searchAddresses: (...a: unknown[]) => searchAddresses(...a),
}))

vi.mock('../../services/searchConfig', () => ({
  SEARCH_MIN_CHARS: 3,
  SEARCH_DEBOUNCE_MS: 0,
  SEARCH_MAX_RESULTS: 5,
  SEARCH_ADDRESS_ZOOM: 17,
}))

function renderBox() {
  return render(<MantineProvider><SearchBox /></MantineProvider>)
}

function type(text: string) {
  fireEvent.change(screen.getByLabelText('Search an area or address'), { target: { value: text } })
}

describe('SearchBox', () => {
  beforeEach(() => {
    useSearchStore.getState().clear()
    useSearchStore.setState({ open: true })
    searchAddresses.mockReset().mockResolvedValue([])
  })

  it('suggests areas by name, ignoring accents', async () => {
    renderBox()
    type('gracia')
    expect(await screen.findByText('la Vila de Gràcia')).toBeInTheDocument()
  })

  it('selecting an area writes it to the store with bounds and outline', async () => {
    renderBox()
    type('gracia')
    fireEvent.click(await screen.findByText('la Vila de Gràcia'))
    const s = useSearchStore.getState().selection
    expect(s).toMatchObject({ kind: 'area', label: 'la Vila de Gràcia', bounds: [2.15, 41.4, 2.16, 41.41] })
  })

  it('lists address suggestions and selects one', async () => {
    searchAddresses.mockResolvedValue([{ label: 'Carrer de Gràcia 1, Barcelona', coords: [2.15, 41.4] }])
    renderBox()
    type('carrer de')
    fireEvent.click(await screen.findByText('Carrer de Gràcia 1, Barcelona'))
    expect(useSearchStore.getState().selection).toMatchObject({ kind: 'address', coords: [2.15, 41.4] })
  })

  it('does not query addresses below the minimum length', async () => {
    renderBox()
    type('ca')
    await new Promise((r) => setTimeout(r, 20))
    expect(searchAddresses).not.toHaveBeenCalled()
  })

  it('the close button empties the field, drops the selection and closes the search', async () => {
    renderBox()
    type('gracia')
    fireEvent.click(await screen.findByText('la Vila de Gràcia'))
    fireEvent.click(screen.getByLabelText('Close search'))
    expect(useSearchStore.getState().selection).toBeNull()
    expect(useSearchStore.getState().open).toBe(false)
    expect(screen.queryByLabelText('Search an area or address')).toBeNull()
  })

  it('is hidden until the search button opens it, and forgets the text when closed', () => {
    useSearchStore.setState({ open: false })
    renderBox()
    expect(screen.queryByLabelText('Search an area or address')).toBeNull()
    act(() => useSearchStore.getState().setOpen(true))
    type('gracia')
    expect(screen.getByLabelText('Search an area or address')).toHaveValue('gracia')
    act(() => useSearchStore.getState().setOpen(false))
    act(() => useSearchStore.getState().setOpen(true))
    expect(screen.getByLabelText('Search an area or address')).toHaveValue('')
  })

  it('opens focused, and Escape closes it', () => {
    renderBox()
    const input = screen.getByLabelText('Search an area or address')
    expect(input).toHaveFocus()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(useSearchStore.getState().open).toBe(false)
  })

  it('shows a hint when nothing matches', async () => {
    renderBox()
    type('zzzzzz')
    await waitFor(() => expect(screen.getByText('Nothing found')).toBeInTheDocument())
  })
})
