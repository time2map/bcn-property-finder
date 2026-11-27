import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { URL_DEFAULTS, useStore } from '../../store'
import { PRESETS } from '../../services/presets'
import { profileToPatch } from '../../services/conditionOptions'
import { useMapStore } from '../../store/mapStore'
import { useSearchStore } from '../../store/searchStore'
import type { AreaRank } from '../../services/areas/areaRank'
import type { AreaFeature } from '../../services/areas'

vi.mock('../../services/shareImage/shareImageBrowser', () => ({
  renderShareBlob: vi.fn(() => Promise.resolve(new Blob(['x'], { type: 'image/png' }))),
  deliverImage: vi.fn(() => Promise.resolve('saved')),
}))
import { deliverImage, renderShareBlob } from '../../services/shareImage/shareImageBrowser'

const feature: AreaFeature = {
  type: 'Feature',
  properties: { id: 'barri-0131', name: 'la Vila de Gràcia', kind: 'barri' },
  geometry: { type: 'Polygon', coordinates: [[[2.15, 41.40], [2.17, 41.40], [2.17, 41.42], [2.15, 41.42], [2.15, 41.40]]] },
}
let join: Map<number, AreaFeature> | null = new Map([[3, feature]])
vi.mock('../../hooks/useAreaJoin', () => ({ useAreaJoin: () => join }))

const RANK: AreaRank = {
  index: 3, code: '31', name: 'la Vila de Gràcia', kind: 'barri', n: 1240, mean: 71.4, shareGood: 70.6, shareGreat: 22.2,
  gapShare: 0, incomplete: false, strongest: ['noise', 'poiAccess'], ranked: true,
}

const renderCard = () => render(<MantineProvider><AreaCard /></MantineProvider>)
import { AreaCard } from './AreaCard'

describe('AreaCard (TODO-064)', () => {
  beforeEach(() => {
    join = new Map([[3, feature]])
    useStore.getState().applySettings({
      weights: URL_DEFAULTS.weights, conditions: URL_DEFAULTS.conditions, riskStrengths: URL_DEFAULTS.riskStrengths,
    })
    useStore.setState({ areaRanks: [RANK], selectedArea: 3, selectedBuilding: null })
    useMapStore.setState({ map: { id: 'map' } as never })
    useSearchStore.setState({ selection: null })
    vi.mocked(renderShareBlob).mockClear()
    vi.mocked(deliverImage).mockClear()
  })
  afterEach(cleanup)

  it('shows the name, the description and the numbers', async () => {
    renderCard()
    expect(screen.getByText('la Vila de Gràcia')).toBeInTheDocument()
    expect(await screen.findByText(/Formerly an independent town/)).toBeInTheDocument()
    expect(screen.getByText('71%')).toBeInTheDocument()
    expect(screen.getByText('of 1,240 homes are a good match')).toBeInTheDocument()
    expect(screen.getByText(/22% are a great match/)).toBeInTheDocument()
    expect(screen.getByText(/Strongest on: quiet, everyday services/i)).toBeInTheDocument()
  })

  it('shows nothing while no area is selected', () => {
    useStore.setState({ selectedArea: null })
    renderCard()
    expect(screen.queryByTestId('area-card')).toBeNull()
  })

  it('has no description for a municipality and does not claim a share for an unranked area', () => {
    useStore.setState({
      areaRanks: [{ ...RANK, code: '08015', kind: 'muni', name: 'Badalona', n: 12, ranked: false }],
    })
    renderCard()
    expect(screen.queryByText(/Formerly/)).toBeNull()
    expect(screen.getByText('12 homes: too few to rank')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Save image/ })).toBeNull()
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument()
  })

  it('closes with the button and takes the outline away', () => {
    useSearchStore.setState({ selection: { kind: 'area', requestId: 1, label: 'x', bounds: [0, 0, 1, 1], outline: { type: 'FeatureCollection', features: [] } } })
    renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Close area card' }))
    expect(useStore.getState().selectedArea).toBeNull()
    expect(useSearchStore.getState().selection).toBeNull()
  })

  it('closes with Escape', () => {
    renderCard()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(useStore.getState().selectedArea).toBeNull()
  })

  it('makes the picture of the area with its numbers', async () => {
    renderCard()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Save image/ })) })
    const [, lngLat, model] = vi.mocked(renderShareBlob).mock.calls[0]
    expect(lngLat).toEqual([expect.closeTo(2.16, 5), expect.closeTo(41.41, 5)])
    expect(model).toMatchObject({ kind: 'area', place: 'la Vila de Gràcia', value: '71%' })
    expect(deliverImage).toHaveBeenCalled()
  })

  it('copies the link to the static page when the settings are a profile', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    useStore.getState().applySettings(profileToPatch(PRESETS[0]))
    renderCard()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Share' })) })
    expect(writeText.mock.calls[0][0]).toMatch(/\/share\/[a-z]+\/la-vila-de-gracia\/$/)
    expect(await screen.findByText(/opens this area/)).toBeInTheDocument()
  })

  it('copies the map link when the settings are not a profile', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    renderCard()
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Share' })) })
    expect(writeText.mock.calls[0][0]).not.toContain('/share/')
    expect(writeText.mock.calls[0][0]).toContain('c=')
  })
})
