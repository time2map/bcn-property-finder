import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { RankLines } from './RankLines'
import type { BuildingRanks } from '../../services/buildings/buildingRank'

const award = (tier: number) => ({ above: 1, n: 10, tier })
const renderLines = (ranks: BuildingRanks) => render(<MantineProvider><RankLines ranks={ranks} /></MantineProvider>)

describe('RankLines', () => {
  it('writes the tier and the place on each tile', () => {
    renderLines({
      local: { name: 'el Raval', kind: 'barri', rank: award(10) },
      wide: { scope: 'barcelona', rank: award(10) },
    })
    expect(screen.getByTestId('rank-local')).toHaveTextContent('Top 10%of homes in el Raval')
    expect(screen.getByTestId('rank-wide')).toHaveTextContent('Top 10%of homes in Barcelona')
  })

  it('explains a barri that is harder than the city: Top 20% in the barri, Top 10% in Barcelona', () => {
    renderLines({
      local: { name: 'Sant Martí de Provençals', kind: 'barri', rank: award(20) },
      wide: { scope: 'barcelona', rank: award(10) },
    })
    expect(screen.getByTestId('rank-crowded')).toHaveTextContent(/a lot of good homes/)
  })

  it.each([
    ['the same tier', award(10), award(10)],
    ['a barri that is easier than the city', award(10), award(20)],
  ])('has no note for %s', (_, local, wide) => {
    renderLines({ local: { name: 'el Raval', kind: 'barri', rank: local }, wide: { scope: 'barcelona', rank: wide } })
    expect(screen.queryByTestId('rank-crowded')).not.toBeInTheDocument()
  })

  it('has no note with a single tile', () => {
    renderLines({ local: null, wide: { scope: 'barcelona', rank: award(10) } })
    expect(screen.queryByTestId('rank-crowded')).not.toBeInTheDocument()
  })

  it('draws nothing without a tile', () => {
    renderLines({ local: null, wide: null })
    expect(screen.queryByTestId('rank-lines')).not.toBeInTheDocument()
    expect(screen.queryByTestId('rank-crowded')).not.toBeInTheDocument()
  })
})
