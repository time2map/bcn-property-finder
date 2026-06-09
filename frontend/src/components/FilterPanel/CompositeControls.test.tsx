import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { CompositeControls } from './CompositeControls'
import { useStore, DEFAULT_COMPOSITE_WEIGHTS } from '../../store'

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
      compositeScoreRange: [0, 100],
      idealistaPriceBounds: null,
      enabledLandmarkIds: ['sagrada', 'barceloneta'],
    })
  })

  it('renders a Livability Index toggle', () => {
    renderControls()
    expect(screen.getByText('Livability Index')).toBeTruthy()
  })

  it('shows component rows when layer is enabled', () => {
    useStore.setState({ compositeVisible: true })
    renderControls()
    expect(screen.getByText('Walkability')).toBeTruthy()
    expect(screen.getByText('Noise')).toBeTruthy()
    expect(screen.getByText('City Core Access')).toBeTruthy()
    expect(screen.getByText('Market Price')).toBeTruthy()
  })

  it('enables the layer on toggle', () => {
    renderControls()
    fireEvent.click(screen.getByRole('switch'))
    expect(useStore.getState().compositeVisible).toBe(true)
  })

  it('disabling a component sets its weight to 0', () => {
    useStore.setState({ compositeVisible: true })
    renderControls()
    fireEvent.click(screen.getByLabelText('Enable Noise'))
    expect(useStore.getState().compositeWeights.noise).toBe(0)
  })

  it('shows score range slider when visible', () => {
    useStore.setState({ compositeVisible: true })
    renderControls()
    expect(screen.getByText('Score range')).toBeTruthy()
    expect(screen.getByLabelText('Score range filter')).toBeTruthy()
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
})
