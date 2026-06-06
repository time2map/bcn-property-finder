import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { PoiAccessControls } from './PoiAccessControls'
import { useStore } from '../../store'

function renderControls() {
  return render(
    <MantineProvider>
      <PoiAccessControls />
    </MantineProvider>,
  )
}

describe('PoiAccessControls', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({ poiAccessVisible: false })
  })

  it('renders a POI Access toggle', () => {
    renderControls()
    expect(screen.getByLabelText('POI Access')).toBeTruthy()
  })

  it('enables the layer on toggle', () => {
    renderControls()
    fireEvent.click(screen.getByLabelText('POI Access'))
    expect(useStore.getState().poiAccessVisible).toBe(true)
  })

  it('shows the legend when layer is enabled', () => {
    useStore.setState({ poiAccessVisible: true })
    renderControls()
    expect(screen.getByLabelText('POI Access colour scale')).toBeTruthy()
  })
})
