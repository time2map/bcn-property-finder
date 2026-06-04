import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { LivabilityControls } from './LivabilityControls'
import { useStore } from '../../store'

function renderControls() {
  return render(
    <MantineProvider>
      <LivabilityControls />
    </MantineProvider>,
  )
}

describe('LivabilityControls', () => {
  beforeEach(() => {
    localStorage.clear()
    useStore.setState({ livabilityVisible: false, livabilityConsiderNoise: false })
  })

  it('hides the "Consider noise" sub-option until the layer is enabled', () => {
    renderControls()
    expect(screen.queryByLabelText('Consider noise')).toBeNull()
  })

  it('enables the layer and reveals the "Consider noise" sub-option', () => {
    renderControls()
    fireEvent.click(screen.getByLabelText('Livability'))
    expect(useStore.getState().livabilityVisible).toBe(true)
    expect(screen.getByLabelText('Consider noise')).toBeInTheDocument()
  })

  it('toggles considerNoise in the store', () => {
    useStore.setState({ livabilityVisible: true })
    renderControls()
    fireEvent.click(screen.getByLabelText('Consider noise'))
    expect(useStore.getState().livabilityConsiderNoise).toBe(true)
  })
})
