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
      street_t10: 0.06, street_t100: 0.16,
    },
  }
  // Barcelona cell without modelled street water (037)
  const dry = { ...bundle, h3: 'dry', climate: { street_t10: 0, street_t100: 0 } }
  return {
    hexBundleMap: new Map([['abc123', bundle], ['risky', risky], ['dry', dry]]),
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
      compositeRiskStrengths: { flood: 5, fire: 5, street: 5 },
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
      // bundle without street fields = outside the RESCCUE model area
      expect(screen.getByText('No street-flooding model outside Barcelona')).toBeInTheDocument()
      expect(screen.getByText('River flooding')).toBeInTheDocument()
    })

    it('says when a Barcelona cell has no significant street flooding (037)', () => {
      useStore.setState({ selectedHexH3: 'dry' })
      renderCard()
      expect(screen.getByText('No significant street flooding modelled')).toBeInTheDocument()
      expect(screen.queryByText(/ground-floor/)).not.toBeInTheDocument()
    })

    it('shows the flood zone, wildfire exposure and points lost', () => {
      useStore.setState({ selectedHexH3: 'risky' })
      renderCard()
      expect(screen.getByText('500-year flood zone (35% of cell)')).toBeInTheDocument()
      expect(screen.getByText('Wildland–urban interface · hazard class 9 forest at ~80 m')).toBeInTheDocument()
      expect(screen.getByText('Effective flooded area: 6% (10-year rain) · 16% (100-year rain)')).toBeInTheDocument()
      expect(screen.getByText('Matters most for ground-floor flats, basements and underground parking')).toBeInTheDocument()
      expect(screen.getAllByText(/^−\d+ pts$/)).toHaveLength(3)
      expect(screen.getByText(/before risk penalties/)).toBeInTheDocument()
    })

    it('hides the section when all penalties are off', () => {
      useStore.setState({ selectedHexH3: 'risky', compositeRiskStrengths: { flood: 0, fire: 0, street: 0 } })
      renderCard()
      expect(screen.queryByText('Climate risk')).not.toBeInTheDocument()
    })

    it('shows only the enabled risk', () => {
      useStore.setState({ selectedHexH3: 'risky', compositeRiskStrengths: { flood: 5, fire: 0, street: 0 } })
      renderCard()
      expect(screen.getByText('500-year flood zone (35% of cell)')).toBeInTheDocument()
      expect(screen.queryByText(/hazard class/)).not.toBeInTheDocument()
    })
  })
})
