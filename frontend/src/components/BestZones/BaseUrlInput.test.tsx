import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { BaseUrlInput } from './BaseUrlInput'
import { useIdealistaBaseUrlStore } from '../../store/idealistaBaseUrlStore'

const VALID_URL = 'https://www.idealista.com/en/areas/venta-viviendas/con-precio-hasta_500000/?shape=((old))'
const VALID_BASE = 'https://www.idealista.com/en/areas/venta-viviendas/con-precio-hasta_500000/'

function renderInput() {
  return render(
    <MantineProvider>
      <BaseUrlInput />
    </MantineProvider>,
  )
}

describe('BaseUrlInput', () => {
  beforeEach(() => {
    useIdealistaBaseUrlStore.setState({ baseUrl: null })
    localStorage.clear()
  })

  it('renders a text input', () => {
    renderInput()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('pre-fills the input with the saved base URL', () => {
    useIdealistaBaseUrlStore.setState({ baseUrl: VALID_BASE })
    renderInput()
    expect(screen.getByRole('textbox')).toHaveValue(VALID_BASE)
  })

  it('saves a valid URL on blur (strips shape param)', () => {
    renderInput()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: VALID_URL } })
    fireEvent.blur(input)
    expect(useIdealistaBaseUrlStore.getState().baseUrl).toBe(VALID_BASE)
  })

  it('shows "Filters saved" after a valid URL is committed', () => {
    renderInput()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: VALID_URL } })
    fireEvent.blur(input)
    expect(screen.getByText('Filters saved')).toBeInTheDocument()
  })

  it('shows "Invalid URL" for a non-Idealista URL', () => {
    renderInput()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'https://example.com/foo' } })
    fireEvent.blur(input)
    expect(screen.getByText('Invalid URL')).toBeInTheDocument()
    expect(useIdealistaBaseUrlStore.getState().baseUrl).toBeNull()
  })

  it('rejects an Idealista URL that is not a property search page', () => {
    renderInput()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: 'https://www.idealista.com/en/' } })
    fireEvent.blur(input)
    expect(screen.getByText('Invalid URL')).toBeInTheDocument()
  })

  it('commits on Enter key', () => {
    renderInput()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: VALID_URL } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(useIdealistaBaseUrlStore.getState().baseUrl).toBe(VALID_BASE)
  })

  it('shows clear button when baseUrl is set', () => {
    useIdealistaBaseUrlStore.setState({ baseUrl: VALID_BASE })
    renderInput()
    expect(screen.getByTitle('Clear saved filters')).toBeInTheDocument()
  })

  it('clear button resets the store and input', () => {
    useIdealistaBaseUrlStore.setState({ baseUrl: VALID_BASE })
    renderInput()
    fireEvent.click(screen.getByTitle('Clear saved filters'))
    expect(useIdealistaBaseUrlStore.getState().baseUrl).toBeNull()
    expect(screen.getByRole('textbox')).toHaveValue('')
  })

  it('clearing the input text and blurring also clears the store', () => {
    useIdealistaBaseUrlStore.setState({ baseUrl: VALID_BASE })
    renderInput()
    const input = screen.getByRole('textbox')
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.blur(input)
    expect(useIdealistaBaseUrlStore.getState().baseUrl).toBeNull()
  })
})
