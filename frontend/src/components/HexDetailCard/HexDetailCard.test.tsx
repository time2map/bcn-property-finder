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
  // Same cell exposed to both climate risks (036)
  const risky = {
    ...bundle,
    h3: 'risky',
    climate: {
      flood_t10: 0, flood_t100: 0, flood_t500: 0.35,
      fire_wui: 1, fire_hazard: 0.6, fire_class: 9, fire_dist_m: 80,
    },
  }
  return {
    hexBundleMap: new Map([['abc123', bundle], ['risky', risky]]),
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
      compositeRiskStrengths: { flood: 5, fire: 5 },
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

  describe('climate risk (036)', () => {
    it('explains a safe cell without penalties', () => {
      useStore.setState({ selectedHexH3: 'abc123' })
      renderCard()
      expect(screen.getByText('Climate risk')).toBeInTheDocument()
      expect(screen.getByText('Outside mapped river flood zones')).toBeInTheDocument()
      expect(screen.getByText('Not in the wildland–urban interface')).toBeInTheDocument()
    })

    it('shows the flood zone, wildfire exposure and points lost', () => {
      useStore.setState({ selectedHexH3: 'risky' })
      renderCard()
      expect(screen.getByText('500-year flood zone (35% of cell)')).toBeInTheDocument()
      expect(screen.getByText('Wildland–urban interface · hazard class 9 forest at ~80 m')).toBeInTheDocument()
      expect(screen.getAllByText(/^−\d+ pts$/)).toHaveLength(2)
      expect(screen.getByText(/before risk penalties/)).toBeInTheDocument()
    })

    it('hides the section when both penalties are off', () => {
      useStore.setState({ selectedHexH3: 'risky', compositeRiskStrengths: { flood: 0, fire: 0 } })
      renderCard()
      expect(screen.queryByText('Climate risk')).not.toBeInTheDocument()
    })

    it('shows only the enabled risk', () => {
      useStore.setState({ selectedHexH3: 'risky', compositeRiskStrengths: { flood: 5, fire: 0 } })
      renderCard()
      expect(screen.getByText('500-year flood zone (35% of cell)')).toBeInTheDocument()
      expect(screen.queryByText(/hazard class/)).not.toBeInTheDocument()
    })
  })
})
