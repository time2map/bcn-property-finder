import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { ClimateLayerControls } from './ClimateLayerControls'
import { useStore } from '../../store'

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
  return render(<MantineProvider><ClimateLayerControls /></MantineProvider>)
}

describe('ClimateLayerControls', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({
      floodLayerVisible: false, wildfireLayerVisible: false,
      streetFloodingLayerVisible: false, streetFloodingReturnPeriod: 't10',
    })
  })

  it('renders both switches off without legends', () => {
    renderControls()
    expect((screen.getByLabelText('River flood zones') as HTMLInputElement).checked).toBe(false)
    expect((screen.getByLabelText('Wildfire hazard') as HTMLInputElement).checked).toBe(false)
    expect(screen.queryByText('River flood zones · ACA — by probability')).toBeNull()
  })

  it('toggles the flood layer and shows its legend', () => {
    const { rerender } = renderControls()
    fireEvent.click(screen.getByLabelText('River flood zones'))
    expect(useStore.getState().floodLayerVisible).toBe(true)
    rerender(<MantineProvider><ClimateLayerControls /></MantineProvider>)
    expect(screen.getByText('River flood zones · ACA — by probability')).toBeTruthy()
    expect(screen.getByText('10-year (high probability)')).toBeTruthy()
  })

  it('toggles the wildfire layer and shows hazard classes + WUI', () => {
    useStore.setState({ wildfireLayerVisible: true })
    renderControls()
    expect(screen.getByText('Wildfire hazard 2024')).toBeTruthy()
    expect(screen.getByText('Wildland–urban interface')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Wildfire hazard'))
    expect(useStore.getState().wildfireLayerVisible).toBe(false)
  })

  it('opens the flood info modal', () => {
    useStore.setState({ floodLayerVisible: true })
    renderControls()
    fireEvent.click(screen.getByLabelText('About the flood zones'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/river overflow only/i)).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('opens the wildfire info modal', () => {
    useStore.setState({ wildfireLayerVisible: true })
    renderControls()
    fireEvent.click(screen.getByLabelText('About the wildfire hazard map'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText(/Llei 5\/2003/)).toBeTruthy()
  })

  describe('street flooding (037)', () => {
    it('toggles the layer and shows the depth legend', () => {
      const { rerender } = renderControls()
      expect(screen.queryByText('Street flooding · water depth (RESCCUE)')).toBeNull()
      fireEvent.click(screen.getByLabelText('Street flooding (heavy rain)'))
      expect(useStore.getState().streetFloodingLayerVisible).toBe(true)
      rerender(<MantineProvider><ClimateLayerControls /></MantineProvider>)
      expect(screen.getByText('Street flooding · water depth (RESCCUE)')).toBeTruthy()
      expect(screen.getByText('10–30 cm')).toBeTruthy()
      expect(screen.getByText('> 50 cm')).toBeTruthy()
    })

    it('switches the return period shown', () => {
      useStore.setState({ streetFloodingLayerVisible: true })
      renderControls()
      fireEvent.click(screen.getByText('100-year rain'))
      expect(useStore.getState().streetFloodingReturnPeriod).toBe('t100')
    })

    it('explains who it matters for and how it differs from river zones', () => {
      useStore.setState({ streetFloodingLayerVisible: true })
      renderControls()
      fireEvent.click(screen.getByLabelText('About street flooding'))
      const dialog = within(screen.getByRole('dialog'))
      expect(dialog.getByText(/ground-floor flats, basements and underground parking/i)).toBeTruthy()
      expect(dialog.getByText(/River flood zones/)).toBeTruthy()
      expect(dialog.getAllByText(/RESCCUE/).length).toBeGreaterThan(0)
    })
  })
})
