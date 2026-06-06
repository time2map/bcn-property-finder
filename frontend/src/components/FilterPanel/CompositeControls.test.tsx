import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { CompositeControls } from './CompositeControls'
import { useStore, DEFAULT_COMPOSITE_WEIGHTS } from '../../store'

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
      idealistaPriceRange: [200_000, 600_000],
    })
  })

  it('renders a Composite Index toggle', () => {
    renderControls()
    expect(screen.getByLabelText('Composite Index')).toBeTruthy()
  })

  it('shows component rows when layer is enabled', () => {
    useStore.setState({ compositeVisible: true })
    renderControls()
    expect(screen.getByText('POI Access')).toBeTruthy()
    expect(screen.getByText('Noise')).toBeTruthy()
    expect(screen.getByText('City Core Access')).toBeTruthy()
    expect(screen.getByText('Idealista Price')).toBeTruthy()
  })

  it('enables the layer and shows components on toggle', () => {
    renderControls()
    fireEvent.click(screen.getByLabelText('Composite Index'))
    expect(useStore.getState().compositeVisible).toBe(true)
    expect(screen.getByText('POI Access')).toBeTruthy()
  })

  it('disabling a component checkbox sets its weight to 0', () => {
    useStore.setState({ compositeVisible: true })
    renderControls()
    const noiseCheckbox = screen.getByLabelText('Enable Noise')
    expect(noiseCheckbox).toBeTruthy()
    fireEvent.click(noiseCheckbox)
    expect(useStore.getState().compositeWeights.noise).toBe(0)
  })

  it('shows price range note when price weight is > 0', () => {
    useStore.setState({
      compositeVisible: true,
      compositeWeights: { ...DEFAULT_COMPOSITE_WEIGHTS, price: 8 },
    })
    renderControls()
    expect(screen.getByText(/Price score:/)).toBeTruthy()
  })

  it('hides price range note when price weight is 0', () => {
    useStore.setState({
      compositeVisible: true,
      compositeWeights: { ...DEFAULT_COMPOSITE_WEIGHTS, price: 0 },
    })
    renderControls()
    expect(screen.queryByText(/Price score:/)).toBeNull()
  })
})
