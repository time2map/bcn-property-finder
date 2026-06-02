import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { AddPinButton } from './AddPinButton'
import { usePinsStore } from '../../store/pinsStore'

vi.stubGlobal('localStorage', { getItem: vi.fn().mockReturnValue(null), setItem: vi.fn() })

const mockProcessImageFile = vi.fn()
const mockProcessHtmlFile = vi.fn()
vi.mock('../../hooks/useScreenshotDrop', () => ({
  useScreenshotDrop: () => ({
    state: { isDragging: false, dragType: null, isProcessing: false, processingLabel: '', approxBanner: false },
    processImageFile: mockProcessImageFile,
    processHtmlFile: mockProcessHtmlFile,
    handleDragOver: vi.fn(),
    handleDragLeave: vi.fn(),
    handleDrop: vi.fn(),
    dismissBanner: vi.fn(),
  }),
}))

function renderBtn() {
  return render(
    <MantineProvider>
      <AddPinButton onError={vi.fn()} />
    </MantineProvider>,
  )
}

describe('AddPinButton', () => {
  beforeEach(() => {
    usePinsStore.setState({ pins: [], selectedPinId: null, isAddingPin: false })
    vi.clearAllMocks()
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

  it('clicking + marks the button as a menu trigger (aria)', () => {
    renderBtn()
    const btn = screen.getByLabelText('Add apartment pin')
    fireEvent.click(btn)
    expect(btn).toHaveAttribute('aria-haspopup', 'menu')
    expect(btn).toHaveAttribute('aria-expanded', 'true')
  })

  it('deactivates adding mode when ✕ is clicked', () => {
    usePinsStore.setState({ ...usePinsStore.getState(), isAddingPin: true })
    renderBtn()
    fireEvent.click(screen.getByLabelText('Add apartment pin'))
    expect(usePinsStore.getState().isAddingPin).toBe(false)
  })

  it('Upload photo menu item triggers image file input', () => {
    renderBtn()
    fireEvent.click(screen.getByLabelText('Add apartment pin'))

    const fileInput = document.querySelector('input[accept="image/*"]') as HTMLInputElement
    expect(fileInput).toBeTruthy()

    const file = new File(['data'], 'photo.jpg', { type: 'image/jpeg' })
    Object.defineProperty(fileInput, 'files', { value: [file] })
    fireEvent.change(fileInput)

    expect(mockProcessImageFile).toHaveBeenCalledWith(file)
  })

  it('Import Idealista HTML menu item triggers html file input', () => {
    renderBtn()
    fireEvent.click(screen.getByLabelText('Add apartment pin'))

    const fileInput = document.querySelector('input[accept=".html,.htm"]') as HTMLInputElement
    expect(fileInput).toBeTruthy()

    const file = new File(['<html></html>'], 'listing.html', { type: 'text/html' })
    Object.defineProperty(fileInput, 'files', { value: [file] })
    fireEvent.change(fileInput)

    expect(mockProcessHtmlFile).toHaveBeenCalledWith(file)
  })
})
