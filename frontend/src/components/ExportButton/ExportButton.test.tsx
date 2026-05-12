import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { ExportButton } from './ExportButton'
import { useStore } from '../../store'

const POLYGON = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [2.154, 41.39],
      [2.155, 41.39],
      [2.155, 41.391],
      [2.154, 41.391],
      [2.154, 41.39],
    ],
  ],
}

function renderButton(props: { isLoading?: boolean } = {}) {
  return render(
    <MantineProvider>
      <ExportButton {...props} />
    </MantineProvider>,
  )
}

describe('ExportButton', () => {
  beforeEach(() => {
    useStore.setState({ resultPolygon: null })
    vi.restoreAllMocks()
  })

  it('renders nothing when resultPolygon is null and not loading', () => {
    renderButton()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders disabled when loading and no polygon yet', () => {
    renderButton({ isLoading: true })
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('renders enabled when polygon exists and not loading', () => {
    useStore.setState({ resultPolygon: POLYGON })
    renderButton()
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('renders disabled when polygon exists but loading', () => {
    useStore.setState({ resultPolygon: POLYGON })
    renderButton({ isLoading: true })
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('shows correct label', () => {
    useStore.setState({ resultPolygon: POLYGON })
    renderButton()
    expect(screen.getByRole('button', { name: /open in idealista/i })).toBeInTheDocument()
  })

  it('opens Idealista URL in new tab when clicked', () => {
    useStore.setState({ resultPolygon: POLYGON })
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderButton()
    fireEvent.click(screen.getByRole('button'))
    expect(openSpy).toHaveBeenCalledOnce()
    const [url, target] = openSpy.mock.calls[0]
    expect(url).toMatch(/^https:\/\/www\.idealista\.com\/areas\/venta-viviendas\/mapa-google\?shape=/)
    expect(target).toBe('_blank')
  })

  it('does not open URL when disabled (loading)', () => {
    useStore.setState({ resultPolygon: POLYGON })
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null)
    renderButton({ isLoading: true })
    fireEvent.click(screen.getByRole('button'))
    expect(openSpy).not.toHaveBeenCalled()
  })
})
