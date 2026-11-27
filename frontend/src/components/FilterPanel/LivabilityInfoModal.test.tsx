import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { LivabilityInfoModal } from './LivabilityInfoModal'
import { influenceList } from '../../services/audit/influence'
import { renderWithMantine } from '../Conditions/testUtils'

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core')
  return {
    ...actual,
    Modal: ({ opened, title, children }: { opened: boolean; title: React.ReactNode; children: React.ReactNode }) =>
      opened ? <div role="dialog"><div>{title}</div>{children}</div> : null,
  }
})
vi.mock('../../services/buildings/buildingData', async (orig) => ({
  ...(await orig<typeof import('../../services/buildings/buildingData')>()),
  loadBuildingsMeta: vi.fn(() => Promise.resolve({ minutes_cap: { walk: 30, cityCore: 120 } })),
}))

describe('the info modal of the match score (TODO-073)', () => {
  it('lists the conditions by how much they move the score, largest first', () => {
    expect(influenceList({ noise: 41, openPrice: 48, cityCore: 10, poiAccess: 0 }))
      .toBe('Budget 48%, Quiet 41%, Centre 10%, and Everyday services 0%')
  })

  it('is named for what it is, and says what the score leaves out, its limits and the influence of each condition', async () => {
    renderWithMantine(<LivabilityInfoModal opened onClose={() => {}} />)
    expect(screen.getByText('About the match score')).toBeInTheDocument()
    expect(screen.getByText('What the score does not include')).toBeInTheDocument()
    expect(screen.getByText(/Air quality, green space, safety and public transport/)).toBeInTheDocument()
    expect(screen.getByText(/slopes .* are not counted/)).toBeInTheDocument()
    expect(screen.getByTestId('influence').textContent).toMatch(/Budget \d+%/)
    expect(screen.getByText(/at most a partial match/)).toBeInTheDocument()
  })

  it('gives the reach of the walking data and the flood weights from the settings', async () => {
    renderWithMantine(<LivabilityInfoModal opened onClose={() => {}} />)
    expect(await screen.findByText(/where the walking data end \(30 min\)/)).toBeInTheDocument()
    expect(screen.getByText(/where the walking data end \(120 min\)/)).toBeInTheDocument()
    expect(screen.getByText(/the 100-year zone 27% and the 500-year zone 6%/)).toBeInTheDocument()
  })
})
