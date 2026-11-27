import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { useStore } from '../../store'
import { CompositeLegend } from './CompositeLegend'

const renderLegend = () => render(<MantineProvider><CompositeLegend /></MantineProvider>)

describe('CompositeLegend (TODO-050)', () => {
  beforeEach(() => useStore.setState({ contrastBoost: false, compositeColorRange: [0, 100] }))

  it('shows the four match bands by default, without numbers', () => {
    renderLegend()
    for (const label of ['Great match', 'Good match', 'Partial match', 'Poor match']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.queryByLabelText('Composite score colour scale')).not.toBeInTheDocument()
    expect(screen.queryByText(/85/)).not.toBeInTheDocument()
  })

  it('shows the fitted gradient and its range with Boost contrast on', () => {
    useStore.setState({ contrastBoost: true, compositeColorRange: [42, 88] })
    renderLegend()
    expect(screen.getByLabelText('Composite score colour scale')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('88')).toBeInTheDocument()
    expect(screen.getByText(/relative to the visible area/)).toBeInTheDocument()
    expect(screen.queryByText('Great match')).not.toBeInTheDocument()
  })
})
