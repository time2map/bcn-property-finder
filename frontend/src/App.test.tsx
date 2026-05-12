import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import App from './App'
import { useStore } from './store'

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
  default: {
    Map: vi.fn(() => ({
      addControl: vi.fn(),
      on: vi.fn(),
      remove: vi.fn(),
    })),
    NavigationControl: vi.fn(),
    Marker: vi.fn(() => ({
      setLngLat: vi.fn().mockReturnThis(),
      addTo: vi.fn().mockReturnThis(),
      remove: vi.fn(),
    })),
  },
}))

vi.mock('./hooks/useIsochrone', () => ({
  useIsochrone: vi.fn().mockReturnValue({ isLoading: false }),
}))

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
      mode: 'foot',
      minutes: 60,
      resultPolygon: null,
    })
    vi.spyOn(window.history, 'replaceState')
  })

  it('renders without crashing', () => {
    expect(() => renderApp()).not.toThrow()
  })

  it('renders the map container', () => {
    const { container } = renderApp()
    expect(container.querySelector('[style*="width: 100%"]')).toBeTruthy()
  })

  it('renders the filter panel with title and labels', () => {
    renderApp()
    expect(screen.getByText('Commute from work')).toBeInTheDocument()
    expect(screen.getByText('How you get there')).toBeInTheDocument()
  })

  it('shows all three transport modes', () => {
    renderApp()
    expect(screen.getByText('Walking')).toBeInTheDocument()
    expect(screen.getByText('Cycling')).toBeInTheDocument()
    expect(screen.getByText('Driving')).toBeInTheDocument()
  })

  it('syncs default state to URL on mount', () => {
    renderApp()
    expect(window.history.replaceState).toHaveBeenCalledWith(
      null,
      '',
      expect.stringContaining('mode=foot'),
    )
  })
})

describe('App (integration) - mobile', () => {
  beforeEach(() => {
    useStore.setState({
      workplace: [2.1687, 41.3874],
      mode: 'foot',
      minutes: 60,
      resultPolygon: null,
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

  it('opens drawer when filter button is clicked', () => {
    renderApp()
    const toggleBtn = screen.getByRole('button', { name: /⚙/ })
    fireEvent.click(toggleBtn)
    expect(screen.getByRole('dialog', { name: 'Filters' })).toBeInTheDocument()
  })

  it('closes drawer via close button', () => {
    renderApp()
    fireEvent.click(screen.getByRole('button', { name: /⚙/ }))
    const closeBtn = screen.getByRole('button', { name: /close/i })
    fireEvent.click(closeBtn)
    expect(screen.queryByRole('dialog', { name: 'Filters' })).not.toBeInTheDocument()
  })
})
