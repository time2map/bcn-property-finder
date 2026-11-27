import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import * as maplibregl from 'maplibre-gl'
import { MantineProvider } from '@mantine/core'
import App from './App'
import { useStore } from './store'
import { useSearchStore } from './store/searchStore'

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core')
  return {
    ...actual,
    Drawer: ({
      opened,
      children,
      title,
      onClose,
    }: {
      opened: boolean
      children: React.ReactNode
      title: string
      onClose: () => void
    }) =>
      opened ? (
        <div role="dialog" aria-label={title}>
          <button onClick={onClose}>close</button>
          {children}
        </div>
      ) : null,
  }
})

vi.mock('maplibre-gl', () => ({
  setWorkerUrl: vi.fn(),
  addProtocol: vi.fn(),
  Map: vi.fn(function () {
    return { addControl: vi.fn(), on: vi.fn(), once: vi.fn(), remove: vi.fn() }
  }),
  NavigationControl: vi.fn(function () { return {} }),
  AttributionControl: vi.fn(function () { return {} }),
  Marker: vi.fn(function () {
    return { setLngLat: vi.fn().mockReturnThis(), addTo: vi.fn().mockReturnThis(), remove: vi.fn() }
  }),
}))

vi.mock('./hooks/useIsochrone', () => ({
  useIsochrone: vi.fn().mockReturnValue({ isLoading: false }),
}))

beforeEach(() => { useSearchStore.setState({ open: false, selection: null }) })

function renderApp() {
  return render(
    <MantineProvider>
      <App />
    </MantineProvider>,
  )
}

describe('App (integration)', () => {
  beforeEach(() => {
    useStore.setState({
      workplace: [2.1687, 41.3874],
      minutes: 60,
      resultPolygon: null,
      onboardingOpen: false,
      onboarded: true,
    })
    vi.spyOn(window.history, 'replaceState')
  })

  it('renders without crashing', () => {
    expect(() => renderApp()).not.toThrow()
  })

  it('renders the map container', async () => {
    const { container } = renderApp()
    // The map code is loaded after the first render (TODO-058).
    await waitFor(() => expect(maplibregl.Map).toHaveBeenCalled(), { timeout: 15000 })
    expect(container.querySelector('[style*="width: 100%"]')).toBeTruthy()
  }, 20000)

  it('renders the filter panel, the daily trip among the conditions (078)', () => {
    renderApp()
    expect(screen.getByText(/by public transport/)).toBeInTheDocument()
    expect(screen.queryByText('Commute from work')).not.toBeInTheDocument()
  })

  it('shows a search button, and the search field opens when it is pressed', () => {
    renderApp()
    expect(screen.queryByLabelText('Search an area or address', { selector: 'input' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Search an area or address' }))
    expect(screen.getByLabelText('Search an area or address', { selector: 'input' })).toBeInTheDocument()
  })

  it('syncs default state to URL on mount', () => {
    renderApp()
    expect(window.history.replaceState).toHaveBeenCalledWith(
      null,
      '',
      expect.stringContaining('minutes=60'),
    )
  })
})

describe('App (integration) - first visit (TODO-031)', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({
      workplace: [2.1687, 41.3874], minutes: 60, resultPolygon: null,
      onboardingOpen: true, onboarded: false,
    })
  })

  it('shows the onboarding instead of the filter panel, with the search box still there', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'Where in Barcelona would you like to live?' })).toBeInTheDocument()
    expect(screen.queryByText('Your conditions')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search an area or address' })).toBeInTheDocument()
  })

  it('a profile leads straight to the filter panel with "Your conditions"', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /^Family/ }))
    expect(screen.queryByRole('heading', { name: /Where in Barcelona/ })).not.toBeInTheDocument()
    expect(screen.getByText('Your conditions')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start from a profile' })).toBeInTheDocument()
    // the new panel: the same sentences, now as the controls
    expect(screen.getByText(/on the street side/)).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Noise' })).toBeInTheDocument()
  })

  it('"Change" brings the onboarding back', () => {
    useStore.setState({ onboardingOpen: false, onboarded: true })
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Start from a profile' }))
    expect(screen.getByRole('heading', { name: /Where in Barcelona/ })).toBeInTheDocument()
  })

  it('does not show for a returning visitor', () => {
    useStore.setState({ onboardingOpen: false, onboarded: false })
    renderApp()
    expect(screen.queryByRole('heading', { name: /Where in Barcelona/ })).not.toBeInTheDocument()
  })
})

describe('App (integration) - mobile', () => {
  beforeEach(() => {
    useStore.setState({
      workplace: [2.1687, 41.3874],
      minutes: 60,
      resultPolygon: null,
      onboardingOpen: false,
      onboarded: true,
    })
    vi.spyOn(window.history, 'replaceState')
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('max-width'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })
  })

  it('shows the search pill with the product name, the conditions sheet at peek and the map buttons', () => {
    const { container } = renderApp()
    expect(screen.getByPlaceholderText('Search Barcelona livability map')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Barcelona livability map', hidden: true })).toBeInTheDocument()
    expect(container.querySelector('.mobile-sheet')).toHaveAttribute('data-position', 'peek')
    expect(screen.getByRole('button', { name: 'Show my location' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'About this map' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /open filters/i })).not.toBeInTheDocument()
  })

  it('opens the conditions when the handle is tapped', () => {
    const { container } = renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Open the panel' }))
    expect(container.querySelector('.mobile-sheet')).toHaveAttribute('data-position', 'half')
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Your areas' })).toBeInTheDocument()
  })

  it('shows a selected building in the sheet instead of the conditions', () => {
    const { container } = renderApp()
    act(() => useStore.getState().setSelectedBuilding(3))
    expect(container.querySelector('.mobile-sheet')).toHaveAttribute('data-view', 'building')
    act(() => useStore.getState().setSelectedBuilding(null))
    expect(container.querySelector('.mobile-sheet')).toHaveAttribute('data-view', 'main')
  })

  it('opens About from the map button', async () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'About this map' }))
    const dialog = await screen.findByRole('dialog', { name: 'About and data sources' })
    expect(dialog).toBeInTheDocument()
    expect(dialog).toHaveTextContent('Dirección General del Catastro')
  })

  it('shows the credit line on the map on a phone, and in the first-visit sheet (it folds into © later)', () => {
    renderApp()
    expect(screen.getByRole('link', { name: '© OpenStreetMap contributors' })).toBeInTheDocument()
    act(() => useStore.setState({ onboardingOpen: true, onboarded: false }))
    expect(screen.getByRole('button', { name: 'Data sources' })).toBeInTheDocument()
  })

  it('has the language list in the menu of the search pill on a phone', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    expect(screen.getByRole('option', { name: /English/ })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /Español/ })).toBeInTheDocument()
  })

  it('first visit: the onboarding is a sheet over the map, with the full name on top', () => {
    useStore.setState({ onboardingOpen: true, onboarded: false })
    const { container } = renderApp()
    expect(container.querySelector('.onboarding-sheet')).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Where in Barcelona/ })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Barcelona livability map' })).toBeInTheDocument()
    expect(container.querySelector('.mobile-sheet')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Just show me the map' }))
    expect(container.querySelector('.onboarding-sheet')).toBeNull()
    expect(container.querySelector('.mobile-sheet')).toBeTruthy()
    expect(screen.getByPlaceholderText('Search Barcelona livability map')).toBeInTheDocument()
  })
})
