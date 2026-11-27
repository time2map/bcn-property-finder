import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useStore, DEFAULT_COMPOSITE_WEIGHTS } from '../../store'
import { MatchBar } from './MatchBar'

const NONE = { ...DEFAULT_COMPOSITE_WEIGHTS, poiAccess: 0, noise: 0, cityCore: 0, openPrice: 0 }

describe('MatchBar', () => {
  beforeEach(() => {
    useStore.setState({ compositeWeights: DEFAULT_COMPOSITE_WEIGHTS, buildingScores: Uint8Array.from([90, 70, 50, 10]) })
  })

  it('shows the share of homes per band', () => {
    render(<MatchBar />)
    expect(screen.getByText('Homes by match')).toBeTruthy()
  })

  it('with no condition on, shows no bar of "Poor" (061)', () => {
    useStore.setState({ compositeRiskStrengths: { flood: 0, fire: 0, street: 0 }, compositeWeights: NONE })
    render(<MatchBar />)
    expect(screen.queryByText('Homes by match')).toBeNull()
  })
})
