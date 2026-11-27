import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest'
import { screen, fireEvent, waitFor, within } from '@testing-library/react'
import { FunnelPanel } from './FunnelPanel'
import { useStore } from '../../store'
import { loadNamespace } from '../../i18n'
import { renderWithMantine, resetStore } from '../Conditions/testUtils'
import { cityFixture, VIBE } from '../../services/funnel/funnelFixture'
import { buildFunnelData } from '../../services/funnel/funnelWishes'

const buildings = cityFixture()
const fd = buildFunnelData(buildings, VIBE, 4)
vi.mock('../../services/funnel/funnelData', () => ({
  loadFunnelData: () => Promise.resolve({ buildings, fd }),
}))

/** The first wish button that can still cut. */
const firstOpenWish = () => screen.getAllByRole('button').find((b) => b.classList.contains('funnel-panel__wish-btn') && !(b as HTMLButtonElement).disabled)!

describe('FunnelPanel', () => {
  beforeAll(() => loadNamespace('funnel')) // fetched with the panel code in the app (App.tsx)

  beforeEach(() => {
    resetStore()
    useStore.setState({ funnelOpen: true, funnelPicks: [], funnelSea: false })
  })

  it('happy path: five picks narrow the homes to a spot and open the winner card', async () => {
    renderWithMantine(<FunnelPanel />)
    expect(await screen.findByText('What matters most?')).toBeTruthy()
    expect(screen.getByText(/^400 homes in Barcelona/)).toBeTruthy()

    for (let step = 1; step <= 5; step++) {
      expect(screen.getByText(`Step ${step} of 5`)).toBeTruthy()
      fireEvent.click(firstOpenWish())
    }

    const result = await screen.findByRole('status')
    expect(within(result).getByRole('heading', { name: /^Your building is in el (Raval|Gòtic)$/ })).toBeTruthy()
    expect(within(result).getAllByText(/^top \d+% of the city$/)).toHaveLength(5)
    expect(useStore.getState().funnelPicks).toHaveLength(5)
    // the path: the start and one count per step, each smaller than the one before
    const counts = screen.getAllByText(/^\d+$/).map((el) => Number(el.textContent))
    expect(counts).toHaveLength(6)
    for (let i = 1; i < counts.length; i++) expect(counts[i]).toBeLessThan(counts[i - 1])

    fireEvent.click(within(result).getByRole('button', { name: 'Open its card' }))
    const row = useStore.getState().selectedBuilding
    expect(row).not.toBeNull()
    expect(Array.from(fd.rows)).toContain(row)
  })

  it('shows what each step kept, in the unit of the wish', async () => {
    renderWithMantine(<FunnelPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Quieter street' }))
    expect(screen.getByText(/^up to \d+ dB on the street side$/)).toBeTruthy()
    expect(screen.getByText('And next?')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Quieter street' })).toBeNull() // a wish is picked once
  })

  it('Back drops the last pick, Start again drops them all', async () => {
    renderWithMantine(<FunnelPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Quieter street' }))
    fireEvent.click(screen.getByRole('button', { name: 'Metro nearby' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(useStore.getState().funnelPicks).toEqual(['quiet'])
    fireEvent.click(screen.getByRole('button', { name: 'Start again' }))
    expect(useStore.getState().funnelPicks).toEqual([])
    expect(await screen.findByText('What matters most?')).toBeTruthy()
  })

  it('the sea leaves only the homes within reach of it', async () => {
    renderWithMantine(<FunnelPanel />)
    await screen.findByText('What matters most?')
    fireEvent.click(screen.getByRole('switch', { name: 'Within walking distance of the sea' }))
    expect(useStore.getState().funnelSea).toBe(true)
    const near = Array.from(fd.seaOk).filter(Boolean).length
    await waitFor(() => expect(screen.getByText(new RegExp(`^${near} homes in Barcelona`))).toBeTruthy())
  })

  it('Close closes the funnel', async () => {
    renderWithMantine(<FunnelPanel />)
    fireEvent.click(await screen.findByRole('button', { name: 'Close' }))
    expect(useStore.getState().funnelOpen).toBe(false)
  })
})
