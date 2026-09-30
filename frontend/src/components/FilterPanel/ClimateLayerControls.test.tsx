import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
    useStore.setState({ floodLayerVisible: false, wildfireLayerVisible: false })
  })

  it('renders both switches off without legends', () => {
    renderControls()
    expect((screen.getByLabelText('Flood zones') as HTMLInputElement).checked).toBe(false)
    expect((screen.getByLabelText('Wildfire hazard') as HTMLInputElement).checked).toBe(false)
    expect(screen.queryByText('River flood zones · ACA')).toBeNull()
  })

  it('toggles the flood layer and shows its legend', () => {
    const { rerender } = renderControls()
    fireEvent.click(screen.getByLabelText('Flood zones'))
    expect(useStore.getState().floodLayerVisible).toBe(true)
    rerender(<MantineProvider><ClimateLayerControls /></MantineProvider>)
    expect(screen.getByText('River flood zones · ACA')).toBeTruthy()
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
    expect(screen.getByText(/flash flooding/i)).toBeTruthy()
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
})
