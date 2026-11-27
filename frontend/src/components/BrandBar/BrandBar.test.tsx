import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { BrandBar } from './BrandBar'
import { useSearchStore } from '../../store/searchStore'
import { useStore } from '../../store'

describe('BrandBar', () => {
  it('renders the time2map mark and the "Barcelona livability map" h1', () => {
    render(<BrandBar />)
    expect(screen.getByAltText('time2map')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { level: 1, name: 'Barcelona livability map' }),
    ).toBeInTheDocument()
  })

  it('links the mark to time2map.com', () => {
    render(<BrandBar />)
    const link = screen.getByRole('link', { name: /time2map/i })
    expect(link).toHaveAttribute('href', 'https://time2map.com')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('has a search button to the right of the title that toggles the search field', () => {
    useSearchStore.setState({ open: false })
    render(<BrandBar />)
    const button = screen.getByRole('button', { name: 'Search an area or address' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(button)
    expect(useSearchStore.getState().open).toBe(true)
    expect(button).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(button)
    expect(useSearchStore.getState().open).toBe(false)
  })
})

/** Share lives in the menu button (TODO-066). */
function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
}
function clickShare() {
  fireEvent.click(screen.getByRole('button', { name: 'Share this map' }))
}

describe('BrandBar: menu', () => {
  it('closes after a language is picked', () => {
    render(<BrandBar />)
    openMenu()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('option', { name: /English/ }))
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

describe('BrandBar: Share (TODO-053)', () => {
  const writeText = vi.fn()
  beforeEach(() => {
    vi.useFakeTimers()
    writeText.mockReset().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
    window.history.replaceState(null, '', '/?minutes=60&zoom=12.00&cx=2.17340&cy=41.38510')
    useStore.setState({ conditions: { noiseMaxDb: 58, priceMaxEurM2: 4000, cityCoreMaxMin: 30, walkMaxMin: 10, localsMin: 7.5 } })
  })
  afterEach(() => { vi.useRealTimers(); window.history.replaceState(null, '', '/') })

  it('copies the link with the current settings and says so', async () => {
    render(<BrandBar />)
    openMenu()
    await act(async () => { clickShare() })
    expect(writeText).toHaveBeenCalledTimes(1)
    const url = new URL(writeText.mock.calls[0][0])
    expect(url.searchParams.get('c')).toBe('n:58')
    expect(url.searchParams.get('zoom')).toBe('12.00')
    expect(screen.getByRole('status').textContent).toBe('Link copied. It opens your map with your conditions.')
    act(() => { vi.advanceTimersByTime(3100) })
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('the link carries the settings even before the address has caught up', async () => {
    window.history.replaceState(null, '', '/?minutes=60&zoom=12.00&cx=2.1&cy=41.4') // no c yet
    render(<BrandBar />)
    openMenu()
    await act(async () => { clickShare() })
    expect(writeText.mock.calls[0][0]).toContain('c=n:58')
  })

  it('on a phone with the share sheet, it opens that instead of copying', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never
    render(<BrandBar />)
    openMenu()
    await act(async () => { clickShare() })
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: expect.stringContaining('c=n:58') }))
    expect(writeText).not.toHaveBeenCalled()
  })

  it('when the share sheet is closed by the person, nothing is copied and nothing is said', async () => {
    Object.defineProperty(navigator, 'share', { value: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')), configurable: true })
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as never
    render(<BrandBar />)
    openMenu()
    await act(async () => { clickShare() })
    expect(writeText).not.toHaveBeenCalled()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('tells the person to copy the address when copying is not allowed', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never
    render(<BrandBar />)
    openMenu()
    await act(async () => { clickShare() })
    expect(screen.getByRole('status').textContent).toBe('Could not copy. Copy the link from the address bar.')
  })
})

