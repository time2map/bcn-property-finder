import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { ExportButton } from './ExportButton'
import { useStore } from '../../store'
import { useExclusionsStore } from '../../store/exclusionsStore'
import { resetAreasCache } from '../../services/areas'

const POLYGON = {
  type: 'Polygon' as const,
  coordinates: [[[2.154, 41.39], [2.155, 41.39], [2.155, 41.391], [2.154, 41.391], [2.154, 41.39]]],
}

function poly(x: number, y: number) {
  return {
    type: 'Polygon' as const,
    coordinates: [[[x, y], [x + 0.1, y], [x + 0.1, y + 0.1], [x, y + 0.1], [x, y]]],
  }
}

const FAKE_URL = 'https://www.idealista.com/areas/venta-viviendas/mapa-google?shape=((abc))'

function renderButton(props: { isLoading?: boolean } = {}) {
  return render(
    <MantineProvider>
      <ExportButton {...props} />
    </MantineProvider>,
  )
}

describe('ExportButton', () => {
  beforeEach(() => {
    useStore.setState({
      resultPolygon: null,
      idealistaAreas: [],
      idealistaUrls: [],
      idealistaZonesVisible: true,
      hoveredAreaIndex: null,
    })
    useExclusionsStore.setState({ zones: [] })
    resetAreasCache()
    vi.restoreAllMocks()
  })

  it('renders nothing when resultPolygon is null and not loading', () => {
    renderButton()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('renders a disabled button while loading (no polygon yet)', () => {
    renderButton({ isLoading: true })
    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByText(/building isochrone/i)).toBeInTheDocument()
  })

  it('shows "Make zones for Idealista" when polygon exists but areas not yet computed', () => {
    useStore.setState({ resultPolygon: POLYGON })
    renderButton()
    expect(screen.getByRole('button', { name: /make zones for idealista/i })).not.toBeDisabled()
  })

  it('shows "Make zones" button disabled while loading even with polygon', () => {
    useStore.setState({ resultPolygon: POLYGON })
    renderButton({ isLoading: true })
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('shows a single link labeled "Main Area" for the first (only) area', () => {
    useStore.setState({
      resultPolygon: POLYGON,
      idealistaAreas: [poly(2.0, 41.0)],
      idealistaUrls: [FAKE_URL],
    })
    renderButton()
    const link = screen.getByRole('link', { name: /main area/i })
    expect(link).toHaveAttribute('href', FAKE_URL)
  })

  it('labels first area "Main Area" and subsequent areas by number', () => {
    useStore.setState({
      resultPolygon: POLYGON,
      idealistaAreas: [poly(2.0, 41.0), poly(2.5, 41.5)],
      idealistaUrls: [FAKE_URL + '1', FAKE_URL + '2'],
    })
    renderButton()
    expect(screen.getByRole('link', { name: /main area/i })).toHaveAttribute('href', FAKE_URL + '1')
    expect(screen.getByRole('link', { name: /area 2\/2/i })).toHaveAttribute('href', FAKE_URL + '2')
  })

  it('visibility toggle button exists when areas are shown', () => {
    useStore.setState({
      resultPolygon: POLYGON,
      idealistaAreas: [poly(2.0, 41.0), poly(2.5, 41.5)],
      idealistaUrls: [FAKE_URL + '1', FAKE_URL + '2'],
    })
    renderButton()
    const toggleBtn = screen.getByTitle(/hide zones on map/i)
    fireEvent.click(toggleBtn)
    expect(useStore.getState().idealistaZonesVisible).toBe(false)
  })

  it('sets and clears the hovered area index when hovering a link', () => {
    useStore.setState({
      resultPolygon: POLYGON,
      idealistaAreas: [poly(2.0, 41.0), poly(2.5, 41.5)],
      idealistaUrls: [FAKE_URL + '1', FAKE_URL + '2'],
      hoveredAreaIndex: null,
    })
    renderButton()
    const a2 = screen.getByRole('link', { name: /area 2\/2/i })
    fireEvent.mouseEnter(a2)
    expect(useStore.getState().hoveredAreaIndex).toBe(1)
    fireEvent.mouseLeave(a2)
    expect(useStore.getState().hoveredAreaIndex).toBeNull()
  })
})
