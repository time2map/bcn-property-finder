import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { useStore } from '../../store'
import { CompositeLegend } from './CompositeLegend'
import { MobileLegend } from '../MobileMap/MobileLegend'

const renderLegend = () => render(<MantineProvider><CompositeLegend /></MantineProvider>)
const square = { type: 'Polygon' as const, coordinates: [[[2, 41], [2.1, 41], [2.1, 41.1], [2, 41.1], [2, 41]]] }

describe('CompositeLegend (TODO-050, 077)', () => {
  beforeEach(() => useStore.setState({ resultPolygon: null }))

  it('shows the four match bands, without numbers or a gradient', () => {
    renderLegend()
    for (const label of ['Great match', 'Good match', 'Partial match', 'Poor match']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.queryByLabelText('Composite score colour scale')).not.toBeInTheDocument()
    expect(screen.queryByText(/85/)).not.toBeInTheDocument()
  })

  it('with an isochrone: a worse → better gradient stretched over the commute zone, no numbers', () => {
    useStore.setState({ resultPolygon: square })
    renderLegend()
    expect(screen.getByLabelText('Composite score colour scale')).toBeInTheDocument()
    expect(screen.getByText('Worse')).toBeInTheDocument()
    expect(screen.getByText('Better')).toBeInTheDocument()
    expect(screen.getByText('Colours stretched over your commute zone')).toBeInTheDocument()
    expect(screen.queryByText('Great match')).not.toBeInTheDocument()
  })
})

describe('MobileLegend (TODO-062, 077)', () => {
  beforeEach(() => useStore.setState({ resultPolygon: null, compositeVisible: true }))

  it('the bands, or with an isochrone the worse → better gradient', () => {
    const { unmount } = render(<MobileLegend />)
    expect(screen.getByLabelText('Match bands')).toBeInTheDocument()
    unmount()
    useStore.setState({ resultPolygon: square })
    render(<MobileLegend />)
    expect(screen.getByLabelText('Composite score colour scale')).toBeInTheDocument()
    expect(screen.getByText('Worse')).toBeInTheDocument()
  })
})
