import { describe, it, expect, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { AdvancedSettings } from './AdvancedSettings'
import { useStore } from '../../store'
import { renderWithMantine } from '../Conditions/testUtils'

describe('AdvancedSettings (TODO-052)', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({ compositeRiskStrengths: { flood: 5, fire: 5, street: 5 } })
  })

  it('is closed at first and opens and closes with its header', () => {
    renderWithMantine(<AdvancedSettings />)
    const head = screen.getByRole('button', { name: 'Advanced' })
    expect(head.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByLabelText('River flood risk strength')).toBeNull()
    fireEvent.click(head)
    expect(head.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByLabelText('River flood risk strength')).toBeTruthy()
    fireEvent.click(head)
    expect(screen.queryByLabelText('River flood risk strength')).toBeNull()
  })

  it('sets how much each risk counts, one risk at a time, and says it in words', () => {
    renderWithMantine(<AdvancedSettings />)
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    fireEvent.keyDown(screen.getByLabelText('Wildfire risk strength'), { key: 'ArrowRight' })
    fireEvent.keyDown(screen.getByLabelText('Wildfire risk strength'), { key: 'ArrowRight' })
    expect(useStore.getState().compositeRiskStrengths).toEqual({ flood: 5, fire: 7, street: 5 })
    expect(screen.getByTestId('importance-Wildfire risk').textContent).toBe('Important')
    expect(JSON.parse(localStorage.getItem('bcn_composite_risk_strengths')!).fire).toBe(7)
  })

  it('a risk can be switched off and comes back at its last strength', () => {
    renderWithMantine(<AdvancedSettings />)
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    fireEvent.click(screen.getByLabelText('Enable Street flooding risk'))
    expect(useStore.getState().compositeRiskStrengths.street).toBe(0)
    fireEvent.click(screen.getByLabelText('Enable Street flooding risk'))
    expect(useStore.getState().compositeRiskStrengths.street).toBe(5)
  })

  it('has no Boost contrast switch (077)', () => {
    renderWithMantine(<AdvancedSettings />)
    fireEvent.click(screen.getByRole('button', { name: 'Advanced' }))
    expect(screen.queryByLabelText('Boost contrast for this view')).toBeNull()
  })
})
