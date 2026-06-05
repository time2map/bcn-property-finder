import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { useStore } from '../../store'
import { ALL_LANDMARK_IDS } from '../../services/cityCore/landmarks'
import { CityCorAccessControls } from './CityCorAccessControls'

function renderControls() {
  return render(
    <MantineProvider>
      <CityCorAccessControls />
    </MantineProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
  useStore.setState({ cityCoreVisible: false, enabledLandmarkIds: ALL_LANDMARK_IDS })
})

describe('CityCorAccessControls', () => {
  it('renders the main toggle', () => {
    renderControls()
    expect(screen.getByLabelText('City Core Access')).toBeInTheDocument()
  })

  it('does not show landmark checkboxes when layer is off', () => {
    renderControls()
    expect(screen.queryByLabelText(/sagrada/i)).not.toBeInTheDocument()
  })

  it('shows landmark checkboxes when layer is on', () => {
    useStore.setState({ cityCoreVisible: true })
    renderControls()
    expect(screen.getByLabelText(/sagrada/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/barceloneta/i)).toBeInTheDocument()
  })

  it('toggling the main switch updates store', () => {
    renderControls()
    fireEvent.click(screen.getByLabelText('City Core Access'))
    expect(useStore.getState().cityCoreVisible).toBe(true)
  })

  it('unchecking a landmark removes it from enabledIds', () => {
    useStore.setState({ cityCoreVisible: true })
    renderControls()
    fireEvent.click(screen.getByLabelText(/sagrada/i))
    expect(useStore.getState().enabledLandmarkIds).not.toContain('sagrada')
  })

  it('keeps at least one landmark enabled (cannot uncheck last one)', () => {
    useStore.setState({ cityCoreVisible: true, enabledLandmarkIds: ['sagrada'] })
    renderControls()
    fireEvent.click(screen.getByLabelText(/sagrada/i))
    expect(useStore.getState().enabledLandmarkIds).toContain('sagrada')
  })

  it('"All landmarks" checkbox selects all when clicked while in indeterminate state', () => {
    useStore.setState({ cityCoreVisible: true, enabledLandmarkIds: ['sagrada'] })
    renderControls()
    fireEvent.click(screen.getByLabelText(/all landmarks/i))
    expect(useStore.getState().enabledLandmarkIds.length).toBe(ALL_LANDMARK_IDS.length)
  })
})
