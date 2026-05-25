import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { FilterPanel } from './FilterPanel'

vi.mock('../../store', () => ({
  useStore: vi.fn(() => ({
    minutes: 30,
    setMinutes: vi.fn(),
    noiseLayerVisible: false,
    setNoiseLayerVisible: vi.fn(),
  })),
}))

vi.mock('../NoiseLayer/NoiseLegend', () => ({
  NoiseLegend: () => <div data-testid="noise-legend" />,
}))

vi.mock('../ExportButton/ExportButton', () => ({
  ExportButton: () => <button>Export</button>,
}))

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core')
  return {
    ...actual,
    Modal: ({ opened, onClose, children }: { opened: boolean; onClose: () => void; children: React.ReactNode }) =>
      opened ? (
        <div role="dialog">
          <button aria-label="Close" onClick={onClose} />
          {children}
        </div>
      ) : null,
  }
})

describe('FilterPanel', () => {
  it('renders commute heading and info button', () => {
    render(<MantineProvider><FilterPanel /></MantineProvider>)
    expect(screen.getByText('Commute from work')).toBeTruthy()
    expect(screen.getByLabelText('About the commute zone')).toBeTruthy()
  })

  it('opens the isochrone info modal on info button click', () => {
    render(<MantineProvider><FilterPanel /></MantineProvider>)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByLabelText('About the commute zone'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('What the zone shows')).toBeTruthy()
  })

  it('closes the modal via onClose', () => {
    render(<MantineProvider><FilterPanel /></MantineProvider>)
    fireEvent.click(screen.getByLabelText('About the commute zone'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('renders noise switch', () => {
    render(<MantineProvider><FilterPanel /></MantineProvider>)
    expect(screen.getByLabelText('Noise')).toBeTruthy()
  })
})
