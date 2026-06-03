import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'

vi.mock('../../services/areas', async (orig) => {
  const actual = await orig<typeof import('../../services/areas')>()
  return {
    ...actual,
    loadAreas: vi.fn().mockResolvedValue([
      {
        type: 'Feature',
        properties: { id: 'd-gracia', name: 'Gràcia', kind: 'district' },
        geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      },
    ]),
  }
})

import { ExclusionControls } from './ExclusionControls'
import { useExclusionsStore } from '../../store/exclusionsStore'
import type { Polygon } from 'geojson'

const GEOM: Polygon = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] }

function renderControls() {
  return render(
    <MantineProvider>
      <ExclusionControls />
    </MantineProvider>,
  )
}

describe('ExclusionControls', () => {
  beforeEach(() => {
    localStorage.clear()
    useExclusionsStore.setState({ zones: [], drawingMode: null })
  })

  it('toggles polygon drawing mode via the Draw button', () => {
    renderControls()
    fireEvent.click(screen.getByRole('button', { name: /draw polygon/i }))
    expect(useExclusionsStore.getState().drawingMode).toBe('polygon')
    fireEvent.click(screen.getByRole('button', { name: /drawing/i }))
    expect(useExclusionsStore.getState().drawingMode).toBeNull()
  })

  it('toggles freehand drawing mode', () => {
    renderControls()
    fireEvent.click(screen.getByRole('button', { name: /freehand/i }))
    expect(useExclusionsStore.getState().drawingMode).toBe('freehand')
  })

  it('lists active zones and removes one', () => {
    useExclusionsStore.setState({
      zones: [{ id: '1', name: 'Gràcia', source: 'area', areaId: 'd-gracia', geometry: GEOM }],
    })
    renderControls()
    expect(screen.getByText(/Gràcia/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /remove gràcia/i }))
    expect(useExclusionsStore.getState().zones).toHaveLength(0)
  })

  it('loads area options for the picker', async () => {
    renderControls()
    const input = screen.getByPlaceholderText(/add district/i)
    await waitFor(() => expect(input).toBeInTheDocument())
  })
})
