import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { MatchColoursSwitch } from './MatchColoursSwitch'
import { useStore } from '../../store'
import { renderWithMantine } from '../Conditions/testUtils'

vi.mock('@mantine/core', async () => {
  const actual = await vi.importActual<typeof import('@mantine/core')>('@mantine/core')
  return {
    ...actual,
    Modal: ({ opened, onClose, title, children }: { opened: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode }) =>
      opened ? <div role="dialog"><div>{title}</div><button aria-label="Close" onClick={onClose} />{children}</div> : null,
  }
})

describe('MatchColoursSwitch (TODO-052)', () => {
  beforeEach(() => { localStorage.clear(); useStore.setState({ compositeVisible: true, resultPolygon: null }) })

  it('shows and hides the match colours on the map', () => {
    renderWithMantine(<MatchColoursSwitch />)
    const box = screen.getByLabelText('Show match colours') as HTMLInputElement
    expect(box.checked).toBe(true)
    fireEvent.click(box)
    expect(useStore.getState().compositeVisible).toBe(false)
    expect(localStorage.getItem('bcn_composite_visible')).toBe('false')
    fireEvent.click(box)
    expect(useStore.getState().compositeVisible).toBe(true)
  })

  it('says what the hatch means (060)', () => {
    renderWithMantine(<MatchColoursSwitch />)
    expect(screen.getByText('Hatched = incomplete data (score is a range, colour shows the best case)')).toBeTruthy()
  })

  it('with an isochrone the colours are stretched: a worse → better gradient under the switch (077)', () => {
    const { unmount } = renderWithMantine(<MatchColoursSwitch />)
    expect(screen.queryByLabelText('Composite score colour scale')).toBeNull()
    unmount()
    useStore.setState({ resultPolygon: { type: 'Polygon', coordinates: [[[2, 41], [2.1, 41], [2.1, 41.1], [2, 41]]] } })
    renderWithMantine(<MatchColoursSwitch />)
    expect(screen.getByLabelText('Composite score colour scale')).toBeTruthy()
    expect(screen.getByText('Colours stretched over your commute zone')).toBeTruthy()
  })

  it('opens and closes the explanation of the index', () => {
    renderWithMantine(<MatchColoursSwitch />)
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByLabelText('About the match score'))
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByText('About the match score')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Close'))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
