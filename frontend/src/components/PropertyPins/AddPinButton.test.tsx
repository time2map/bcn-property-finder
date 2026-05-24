import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { AddPinButton } from './AddPinButton'
import { usePinsStore } from '../../store/pinsStore'

vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() })

function renderBtn() {
  return render(
    <MantineProvider>
      <AddPinButton />
    </MantineProvider>,
  )
}

describe('AddPinButton', () => {
  beforeEach(() => {
    usePinsStore.setState({ pins: [], selectedPinId: null, isAddingPin: false })
  })

  it('shows + when not in adding mode', () => {
    renderBtn()
    expect(screen.getByText('+')).toBeInTheDocument()
  })

  it('shows ✕ when in adding mode', () => {
    usePinsStore.setState({ ...usePinsStore.getState(), isAddingPin: true })
    renderBtn()
    expect(screen.getByText('✕')).toBeInTheDocument()
  })

  it('activates adding mode on click', () => {
    renderBtn()
    fireEvent.click(screen.getByLabelText('Add apartment pin'))
    expect(usePinsStore.getState().isAddingPin).toBe(true)
  })

  it('deactivates adding mode when clicked again', () => {
    usePinsStore.setState({ ...usePinsStore.getState(), isAddingPin: true })
    renderBtn()
    fireEvent.click(screen.getByLabelText('Add apartment pin'))
    expect(usePinsStore.getState().isAddingPin).toBe(false)
  })
})
