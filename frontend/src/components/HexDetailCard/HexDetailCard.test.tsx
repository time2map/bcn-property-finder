import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { useStore } from '../../store'
import { DEFAULT_COMPOSITE_WEIGHTS } from '../../store'

vi.mock('../../services/composite/compositeData', () => {
  const bundle = {
    h3: 'abc123',
    geometry: { type: 'Polygon' as const, coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
    walk: 72,
    lden: 53,
    saleEurM2: 4200,
    cityCoreProps: {
      h3: 'abc123',
      sagrada: 12, placa_cat: 4, barceloneta: 18, barri_gotic: 9,
      pg_gracia: 6, arc_triomf: 11, montjuic: 22, placa_espanya: 20,
      glories: 28, poblenou: 35, parc_guell: 45, eixample: 2, waterfront: 40,
    },
  }
  return {
    hexBundleMap: new Map([['abc123', bundle]]),
    get hexOpenPriceBounds() { return { p5: 2000, p95: 6000 } },
  }
})

import { HexDetailCard } from './HexDetailCard'

function renderCard() {
  return render(
    <MantineProvider>
      <HexDetailCard />
    </MantineProvider>,
  )
}

describe('HexDetailCard', () => {
  beforeEach(() => {
    useStore.setState({
      selectedHexH3: null,
      compositeWeights: DEFAULT_COMPOSITE_WEIGHTS,
      enabledLandmarkIds: ['sagrada', 'placa_cat', 'pg_gracia', 'eixample'],
    })
  })

  it('renders nothing when no hex is selected', () => {
    renderCard()
    expect(screen.queryByText('Hex Details')).not.toBeInTheDocument()
  })

  it('renders nothing when selected hex has no bundle data', () => {
    useStore.setState({ selectedHexH3: 'unknown-h3' })
    renderCard()
    expect(screen.queryByText('Hex Details')).not.toBeInTheDocument()
  })

  it('shows livability score when hex is selected', () => {
    useStore.setState({ selectedHexH3: 'abc123' })
    renderCard()
    expect(screen.getByText('Livability')).toBeInTheDocument()
  })

  it('shows Walkability section', () => {
    useStore.setState({ selectedHexH3: 'abc123' })
    renderCard()
    expect(screen.getByText(/Walkability/i)).toBeInTheDocument()
  })

  it('shows noise score and lden value', () => {
    useStore.setState({ selectedHexH3: 'abc123' })
    renderCard()
    expect(screen.getByText(/Noise/i)).toBeInTheDocument()
    expect(screen.getByText(/Lden 53 dB/i)).toBeInTheDocument()
  })

  it('shows city core section with nearest landmarks', () => {
    useStore.setState({ selectedHexH3: 'abc123' })
    renderCard()
    expect(screen.getByText(/City Core/i)).toBeInTheDocument()
    expect(screen.getByText('2 min')).toBeInTheDocument()
  })

  it('shows INCASOL price when openPrice weight > 0', () => {
    useStore.setState({ selectedHexH3: 'abc123' })
    renderCard()
    expect(screen.getByText(/Sale price/i)).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/4[.,]200/)
  })

  it('hides Noise section when noise weight is 0', () => {
    useStore.setState({
      selectedHexH3: 'abc123',
      compositeWeights: { ...DEFAULT_COMPOSITE_WEIGHTS, noise: 0 },
    })
    renderCard()
    expect(screen.queryByText('Lden')).not.toBeInTheDocument()
  })

  it('closes on close button click', () => {
    useStore.setState({ selectedHexH3: 'abc123' })
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: /close hex detail/i }))
    expect(useStore.getState().selectedHexH3).toBeNull()
  })

  it('closes on Escape key', () => {
    useStore.setState({ selectedHexH3: 'abc123' })
    renderCard()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useStore.getState().selectedHexH3).toBeNull()
  })
})
