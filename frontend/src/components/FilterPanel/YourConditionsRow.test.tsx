import { describe, it, expect, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { YourConditionsRow } from './YourConditionsRow'
import { useStore } from '../../store'
import { renderWithMantine, resetStore } from '../Conditions/testUtils'

describe('YourConditionsRow', () => {
  beforeEach(() => { resetStore(); useStore.setState({ onboardingOpen: false, onboarded: true }) })

  it('is a label with a way back to the profiles', () => {
    renderWithMantine(<YourConditionsRow />)
    expect(screen.getByText('Your conditions')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Start from a profile' })).toBeTruthy()
  })

  it('"Start from a profile" opens the onboarding again and keeps the onboarded flag', () => {
    renderWithMantine(<YourConditionsRow />)
    fireEvent.click(screen.getByRole('button', { name: 'Start from a profile' }))
    expect(useStore.getState().onboardingOpen).toBe(true)
    expect(useStore.getState().onboarded).toBe(true)
  })
})
