import { describe, it, expect, beforeEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import { MapLayersControl } from './MapLayersControl'
import { useStore, mapLayerOf } from '../../store'
import { renderWithMantine } from '../Conditions/testUtils'

const off = { noiseLayerVisible: false, floodLayerVisible: false, streetFloodingLayerVisible: false, wildfireLayerVisible: false }

describe('MapLayersControl (TODO-052)', () => {
  beforeEach(() => { localStorage.clear(); useStore.setState({ ...off, streetFloodingReturnPeriod: 't10' }) })

  it('offers None and the four layers, with None chosen at first', () => {
    renderWithMantine(<MapLayersControl />)
    const names = ['None', 'Noise', 'River floods', 'Street flooding', 'Wildfire']
    for (const n of names) expect(screen.getByRole('radio', { name: n })).toBeTruthy()
    expect((screen.getByRole('radio', { name: 'None' }) as HTMLInputElement).checked).toBe(true)
    expect(screen.getByText(/One layer at a time/)).toBeTruthy()
  })

  it('choosing a layer turns exactly that one on and shows its legend only', () => {
    renderWithMantine(<MapLayersControl />)
    fireEvent.click(screen.getByLabelText('Noise'))
    expect(mapLayerOf(useStore.getState())).toBe('noise')
    expect(screen.getByText('Noise · Lden dB(A)')).toBeTruthy()
    expect(screen.queryByText(/One layer at a time/)).toBeNull()
    fireEvent.click(screen.getByLabelText('Wildfire'))
    expect(mapLayerOf(useStore.getState())).toBe('wildfire')
    expect(useStore.getState().noiseLayerVisible).toBe(false)
    expect(screen.queryByText('Noise · Lden dB(A)')).toBeNull()
  })

  it('None clears whatever is on', () => {
    act(() => useStore.setState({ floodLayerVisible: true }))
    renderWithMantine(<MapLayersControl />)
    expect((screen.getByRole('radio', { name: 'River floods' }) as HTMLInputElement).checked).toBe(true)
    fireEvent.click(screen.getByLabelText('None'))
    expect(mapLayerOf(useStore.getState())).toBe('none')
  })

  it('follows a change made elsewhere', () => {
    renderWithMantine(<MapLayersControl />)
    act(() => useStore.getState().setMapLayer('street'))
    expect((screen.getByRole('radio', { name: 'Street flooding' }) as HTMLInputElement).checked).toBe(true)
  })

  it('shows the chosen layer as a filled chip (072)', () => {
    renderWithMantine(<MapLayersControl />)
    const chip = (name: string) => screen.getByLabelText(name).closest('label')!
    expect(chip('None')).toHaveAttribute('data-selected', 'true')
    fireEvent.click(screen.getByLabelText('Noise'))
    expect(chip('Noise')).toHaveAttribute('data-selected', 'true')
    expect(chip('None')).toHaveAttribute('data-selected', 'false')
  })
})
