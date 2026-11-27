import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { CompositeControls } from './CompositeControls'
import { useStore, DEFAULT_COMPOSITE_WEIGHTS, ALL_WALK_CATEGORY_IDS } from '../../store'
import { DEFAULT_CONDITIONS } from '../../services/buildings/conditions'

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core')
  return {
    ...actual,
    Modal: ({ opened, onClose, title, children }: {
      opened: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode
    }) =>
      opened ? (
        <div role="dialog">
          <div>{title}</div>
          <button aria-label="Close" onClick={onClose} />
          {children}
        </div>
      ) : null,
  }
})

function renderControls() {
  return render(
    <MantineProvider>
      <CompositeControls />
    </MantineProvider>,
  )
}

describe('CompositeControls', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({
      compositeVisible: false,
      compositeWeights: { ...DEFAULT_COMPOSITE_WEIGHTS },
      compositeColorRange: [0, 100], contrastBoost: false,
      idealistaPriceBounds: null,
      enabledLandmarkIds: ['sagrada', 'barceloneta'],
      compositeRiskStrengths: { flood: 5, fire: 5, street: 5 },
      ageEras: ['before-1900', '1900-1939', '1940-1979', '1980-2006', '2007-on'], conditions: DEFAULT_CONDITIONS,
      enabledWalkCategories: ALL_WALK_CATEGORY_IDS,
    })
  })

  it('conditions in real units: the sentence follows the slider (049)', () => {
    useStore.setState({ compositeVisible: true })
    renderControls()
    expect(screen.getByText('Everyday services within 10 min walk')).toBeTruthy()
    expect(screen.getByText('Up to 65 dB on the street side is OK for me — like a busy street')).toBeTruthy()
    expect(screen.getByText('My places within 30 min walk')).toBeTruthy()
    expect(screen.getByText(/^I'm ready to pay up to €4[.,]?000\/m²$/)).toBeTruthy()
    for (let k = 0; k < 10; k++) fireEvent.keyDown(screen.getByLabelText('Noise on the street side limit'), { key: 'ArrowLeft' })
    expect(useStore.getState().conditions.noiseMaxDb).toBe(55)
    expect(screen.getByText('Up to 55 dB on the street side is OK for me — like a calm street')).toBeTruthy()
    expect(JSON.parse(localStorage.getItem('bcn_conditions')!).noiseMaxDb).toBe(55)
  })

  it('Boost contrast switch is under the legend, off by default (TODO-050)', () => {
    useStore.setState({ compositeVisible: true, contrastBoost: false })
    renderControls()
    expect(screen.getByText('Great match')).toBeTruthy()
    const toggle = screen.getByLabelText('Boost contrast for this view') as HTMLInputElement
    expect(toggle.checked).toBe(false)
    fireEvent.click(toggle)
    expect(useStore.getState().contrastBoost).toBe(true)
    expect(screen.getByLabelText('Composite score colour scale')).toBeTruthy()
    fireEvent.click(toggle)
    expect(useStore.getState().contrastBoost).toBe(false)
  })

  it('a subset of services or places is said so', () => {
    useStore.setState({ compositeVisible: true, enabledWalkCategories: ['school', 'clinic'], enabledLandmarkIds: ['sagrada'] })
    renderControls()
    expect(screen.getByText('My 2 services within 10 min walk')).toBeTruthy()
    expect(screen.getByText('My place within 30 min walk')).toBeTruthy()
  })

  it('risk penalties keep the words of how much they matter', () => {
    useStore.setState({ compositeVisible: true })
    renderControls()
    expect(screen.getByTestId('importance-River flood risk').textContent).toBe('Matters') // 5
    act(() => useStore.setState({ compositeRiskStrengths: { flood: 1, fire: 3, street: 10 } }))
    expect(screen.getByTestId('importance-River flood risk').textContent).toBe('Slightly important')
    expect(screen.getByTestId('importance-Wildfire risk').textContent).toBe('Somewhat important')
    expect(screen.getByTestId('importance-Street flooding risk').textContent).toBe('Top priority')
  })

  it('building age: off by default; its gear picks the liked eras, never none (TODO-047)', () => {
    useStore.setState({ compositeVisible: true })
    renderControls()
    expect(useStore.getState().compositeWeights.age).toBe(0)
    fireEvent.click(screen.getByLabelText('Enable Building age'))
    expect(useStore.getState().compositeWeights.age).toBe(1)
    expect(screen.getByText("All eras count — untick the ones you don't want")).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Configure Building age'))
    expect(screen.getByText('Building age — eras you like')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Post-war boom · 1940–1979'))
    expect(useStore.getState().ageEras).not.toContain('1940-1979')
    expect(screen.getByText('Liked: before 1900, 1900–1939, 1980–2006, 2007 on')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('All eras'))
    expect(useStore.getState().ageEras).toHaveLength(5)
    fireEvent.click(screen.getByLabelText('All eras'))
    expect(useStore.getState().ageEras).toEqual(['before-1900']) // the last one stays
  })

  it('renders a Match score toggle', () => {
    renderControls()
    expect(screen.getByText('Match score')).toBeTruthy()
  })

  it('shows component rows when layer is enabled', () => {
    useStore.setState({ compositeVisible: true })
    renderControls()
    expect(screen.getByText('Services on foot')).toBeTruthy()
    expect(screen.getByText('Noise on the street side')).toBeTruthy()
    expect(screen.getByText('City Core Access')).toBeTruthy()
    expect(screen.getByText('Market Price')).toBeTruthy()
    expect(screen.getByText("Locals' opinion")).toBeTruthy()
  })

  it("locals' opinion is off by default; on, it asks for the residents' minimum rating (042, 049)", () => {
    useStore.setState({ compositeVisible: true })
    renderControls()
    const box = screen.getByLabelText("Enable Locals' opinion") as HTMLInputElement
    expect(box.checked).toBe(false)
    fireEvent.click(box)
    expect(useStore.getState().compositeWeights.localsOpinion).toBe(1)
    expect(screen.getByLabelText("Locals' opinion limit")).toBeTruthy()
    expect(screen.getByText('Residents rate their barri at least 7.5 / 10')).toBeTruthy()
  })

  it('enables the layer on toggle', () => {
    renderControls()
    fireEvent.click(screen.getByRole('switch'))
    expect(useStore.getState().compositeVisible).toBe(true)
  })

  it('turning a condition off and on', () => {
    useStore.setState({ compositeVisible: true })
    renderControls()
    fireEvent.click(screen.getByLabelText('Enable Noise on the street side'))
    expect(useStore.getState().compositeWeights.noise).toBe(0)
    expect(screen.queryByLabelText('Noise on the street side limit')).toBeNull()
    fireEvent.click(screen.getByLabelText('Enable Noise on the street side'))
    expect(useStore.getState().compositeWeights.noise).toBe(1)
  })

  it('with Boost contrast on, the legend shows the colour range of the visible area; no score range slider (TODO-032, 050)', () => {
    useStore.setState({ compositeVisible: true, contrastBoost: true, compositeColorRange: [58, 84] })
    renderControls()
    expect(screen.getByText('58')).toBeTruthy()
    expect(screen.getByText('84')).toBeTruthy()
    expect(screen.getByText('How well homes meet your conditions, relative to the visible area')).toBeTruthy()
    expect(screen.queryByText('Score range')).toBeNull()
  })

  it('shows gear button for City Core when enabled', () => {
    useStore.setState({ compositeVisible: true })
    renderControls()
    expect(screen.getByLabelText('Configure City Core Access')).toBeTruthy()
  })

  it('does not show gear button for Market Price', () => {
    useStore.setState({ compositeVisible: true })
    renderControls()
    expect(screen.queryByLabelText('Configure Market Price')).toBeNull()
  })

  it('opens city core modal on gear click', () => {
    useStore.setState({ compositeVisible: true })
    renderControls()
    fireEvent.click(screen.getByLabelText('Configure City Core Access'))
    expect(screen.getByText('City Core landmarks')).toBeTruthy()
  })

  it('walkability gear: the user drops services, but never the last one (TODO-046)', () => {
    useStore.setState({ compositeVisible: true, enabledWalkCategories: ['school', 'clinic'] })
    renderControls()
    fireEvent.click(screen.getByLabelText('Configure Services on foot'))
    expect(screen.getByText('Walkability services')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('🎓 School'))
    expect(useStore.getState().enabledWalkCategories).toEqual(['clinic'])
    expect(JSON.parse(localStorage.getItem('bcn_walk_categories')!)).toEqual(['clinic'])
    fireEvent.click(screen.getByLabelText('🏥 Clinic'))
    expect(useStore.getState().enabledWalkCategories).toEqual(['clinic'])
    fireEvent.click(screen.getByLabelText('All services'))
    expect(useStore.getState().enabledWalkCategories).toHaveLength(10)
  })

  describe('risk penalties (036)', () => {
    it('shows flood and wildfire penalty rows when the index is on', () => {
      useStore.setState({ compositeVisible: true })
      renderControls()
      expect(screen.getByText('Risk penalties')).toBeTruthy()
      expect(screen.getByText('River flood risk')).toBeTruthy()
      expect(screen.getByText('Wildfire risk')).toBeTruthy()
      expect(screen.getByText('Street flooding risk')).toBeTruthy()
      expect(screen.getByLabelText('River flood risk strength')).toBeTruthy()
      expect(screen.getByLabelText('Street flooding risk strength')).toBeTruthy()
    })

    it('disabling a risk sets its strength to 0 and re-enabling restores it', () => {
      useStore.setState({ compositeVisible: true, compositeRiskStrengths: { flood: 7, fire: 5, street: 5 } })
      renderControls()
      fireEvent.click(screen.getByLabelText('Enable River flood risk'))
      expect(useStore.getState().compositeRiskStrengths).toEqual({ flood: 0, fire: 5, street: 5 })
      fireEvent.click(screen.getByLabelText('Enable River flood risk'))
      expect(useStore.getState().compositeRiskStrengths).toEqual({ flood: 7, fire: 5, street: 5 })
    })

    it('explains the penalties in the info modal', () => {
      useStore.setState({ compositeVisible: true })
      renderControls()
      fireEvent.click(screen.getByLabelText('About the match score'))
      expect(screen.getByText(/river flood zones/i)).toBeTruthy()
      expect(screen.getByText(/wildland–urban interface/i)).toBeTruthy()
      expect(screen.getByText(/ground-floor flats, basements and underground parking/i)).toBeTruthy()
    })

    it('turns street flooding off independently (037)', () => {
      useStore.setState({ compositeVisible: true })
      renderControls()
      fireEvent.click(screen.getByLabelText('Enable Street flooding risk'))
      expect(useStore.getState().compositeRiskStrengths).toEqual({ flood: 5, fire: 5, street: 0 })
    })
  })
})
