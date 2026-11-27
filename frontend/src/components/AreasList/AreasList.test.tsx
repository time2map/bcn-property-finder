import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, act, within } from '@testing-library/react'
import { AreasList } from './AreasList'
import { useStore, DEFAULT_COMPOSITE_WEIGHTS } from '../../store'
import { useSearchStore } from '../../store/searchStore'
import type { AreaRank } from '../../services/areas/areaRank'
import type { AreaFeature } from '../../services/areas'

const polygon = (name: string): AreaFeature => ({
  type: 'Feature',
  properties: { id: name, name, kind: 'barri' },
  geometry: { type: 'Polygon', coordinates: [[[2, 41], [2.1, 41], [2.1, 41.1], [2, 41.1], [2, 41]]] },
})

let join: Map<number, AreaFeature> | null = null
vi.mock('../../hooks/useAreaJoin', () => ({ useAreaJoin: () => join }))

const rank = (i: number, extra: Partial<AreaRank> = {}): AreaRank => ({
  index: i, code: String(i), name: `Area ${i}`, kind: 'barri', n: 500, mean: 80 - i, shareGood: 90 - i * 3,
  shareGreat: 20, strongest: ['noise', 'openPrice', 'poiAccess'], ranked: true, ...extra,
})
/** 12 barris of Barcelona (0–11) and 7 municipalities of the metro area (20–26). */
const barris = Array.from({ length: 12 }, (_, i) => rank(i))
const munis = Array.from({ length: 7 }, (_, i) => rank(20 + i, { kind: 'muni', name: `Town ${i}`, shareGood: 100 - i * 2 }))
const ranks = [...munis, ...barris]

const rows = (section: HTMLElement) => within(section).queryAllByRole('button', { name: /of homes are a good match/ })
const section = (name: string) => screen.getByRole('region', { name })

describe('AreasList', () => {
  beforeEach(() => {
    join = new Map(ranks.map((r) => [r.index, polygon(r.name)]))
    useSearchStore.setState({ selection: null })
    useStore.setState({ areaRanks: ranks, compositeWeights: DEFAULT_COMPOSITE_WEIGHTS })
  })

  it('two sections, Barcelona and Metro area, each ranked on its own and numbered from 1', () => {
    render(<AreasList />)
    expect(screen.getByText('By the share of homes that fit.')).toBeTruthy()
    const bcn = section('Barcelona')
    const metro = section('Metro area')
    expect(rows(bcn)[0].getAttribute('aria-label')).toBe('1. Area 0, 90% of homes are a good match')
    expect(rows(metro)[0].getAttribute('aria-label')).toBe('1. Town 0, 100% of homes are a good match')
    expect(within(bcn).getByText('Top 10 of 12')).toBeTruthy()
    expect(within(metro).getByText('Top 5 of 7')).toBeTruthy()
  })

  it('shows 10 districts of Barcelona and 5 municipalities at first', () => {
    render(<AreasList />)
    expect(rows(section('Barcelona'))).toHaveLength(10)
    expect(rows(section('Metro area'))).toHaveLength(5)
    expect(screen.getAllByText('quiet').length).toBe(15)
  })

  it('each section has its own "Show all"', () => {
    render(<AreasList />)
    fireEvent.click(within(section('Metro area')).getByRole('button', { name: 'Show all 7' }))
    expect(rows(section('Metro area'))).toHaveLength(7)
    expect(rows(section('Barcelona'))).toHaveLength(10)
    expect(within(section('Metro area')).queryByRole('button', { name: /Show all/ })).toBeNull()
    fireEvent.click(within(section('Barcelona')).getByRole('button', { name: 'Show all 12' }))
    expect(rows(section('Barcelona'))).toHaveLength(12)
    expect(within(section('Barcelona')).getByText('All 12')).toBeTruthy()
  })

  it('a click flies to the area: it becomes the search selection', () => {
    render(<AreasList />)
    fireEvent.click(within(section('Barcelona')).getByRole('button', { name: /^2\. Area 1/ }))
    const sel = useSearchStore.getState().selection
    expect(sel?.kind).toBe('area')
    expect(sel?.label).toBe('Area 1')
    if (sel?.kind === 'area') expect(sel.bounds).toEqual([2, 41, 2.1, 41.1])
    expect(useStore.getState().selectedArea).toBe(1) // its card opens (TODO-064)
    fireEvent.click(within(section('Metro area')).getByRole('button', { name: /^1\. Town 0/ }))
    expect(useSearchStore.getState().selection?.label).toBe('Town 0')
  })

  it('an area without a polygon cannot be flown to', () => {
    join = new Map(ranks.filter((r) => r.index !== 0).map((r) => [r.index, polygon(r.name)]))
    render(<AreasList />)
    const first = within(section('Barcelona')).getByRole('button', { name: /^1\. Area 0/ }) as HTMLButtonElement
    expect(first.disabled).toBe(true)
    fireEvent.click(first)
    expect(useSearchStore.getState().selection).toBeNull()
  })

  it('a section with nothing to rank is left out', () => {
    act(() => useStore.setState({ areaRanks: barris }))
    render(<AreasList />)
    expect(screen.getByRole('region', { name: 'Barcelona' })).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Metro area' })).toBeNull()
  })

  it('names the areas with too few homes instead of ranking them', () => {
    act(() => useStore.setState({ areaRanks: [rank(0), rank(1, { name: 'Tiny', ranked: false, n: 3 }), rank(20, { kind: 'muni', name: 'Hamlet', ranked: false })] }))
    render(<AreasList />)
    expect(rows(section('Barcelona'))).toHaveLength(1)
    expect(screen.queryByRole('region', { name: 'Metro area' })).toBeNull()
    expect(screen.getByText('Too few homes to rank: Tiny, Hamlet.')).toBeTruthy()
    expect(within(section('Barcelona')).getByText('All 1')).toBeTruthy()
  })

  it('says so before the homes are scored and when nothing can be ranked', () => {
    act(() => useStore.setState({ areaRanks: null }))
    const { rerender } = render(<AreasList />)
    expect(screen.getByText('Scoring the homes…')).toBeTruthy()
    act(() => useStore.setState({ areaRanks: [] }))
    rerender(<AreasList />)
    expect(screen.getByText(/No areas to rank yet/)).toBeTruthy()
  })

  it('asks for a condition instead of ranking when none is on (061)', () => {
    useStore.setState({ compositeRiskStrengths: { flood: 0, fire: 0, street: 0 }, compositeWeights: { ...DEFAULT_COMPOSITE_WEIGHTS, poiAccess: 0, noise: 0, cityCore: 0, openPrice: 0 } })
    render(<AreasList />)
    expect(screen.getByText('Add a condition to rank the areas.')).toBeTruthy()
    expect(screen.queryByRole('region', { name: 'Barcelona' })).toBeNull()
    useStore.setState({ compositeWeights: DEFAULT_COMPOSITE_WEIGHTS })
  })

  it('works before the polygons have loaded (rows are shown, not clickable)', () => {
    join = null
    render(<AreasList />)
    expect((rows(section('Barcelona'))[0] as HTMLButtonElement).disabled).toBe(true)
  })
})
