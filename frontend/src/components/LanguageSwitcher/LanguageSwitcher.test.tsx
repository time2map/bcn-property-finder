import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { LanguageSwitcher } from './LanguageSwitcher'
import { setLanguage } from '../../i18n'

describe('LanguageSwitcher', () => {
  beforeEach(async () => {
    localStorage.clear()
    window.history.replaceState(null, '', '/')
    await setLanguage('en')
  })

  it('shows the current language code on a button that opens a list', () => {
    render(<LanguageSwitcher />)
    const button = screen.getByRole('button', { name: 'Change language' })
    expect(button).toHaveTextContent('EN')
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('listbox')).toBeNull()
  })

  it('lists every enabled language by its own name and marks the current one', () => {
    render(<LanguageSwitcher />)
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }))
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual(['English', 'Español', 'Català'])
    expect(screen.getByRole('option', { name: 'English' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('option', { name: 'Español' })).toHaveAttribute('lang', 'es')
  })

  it('switches the language, closes the list and translates its own label', async () => {
    render(<LanguageSwitcher />)
    fireEvent.click(screen.getByRole('button', { name: 'Change language' }))
    fireEvent.click(screen.getByRole('option', { name: 'Español' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cambiar de idioma' })).toHaveTextContent('ES'))
    expect(screen.queryByRole('listbox')).toBeNull()
    expect(localStorage.getItem('bcn_lang')).toBe('es')
  })

  it('closes on Escape and on a click outside', () => {
    render(<div><span>outside</span><LanguageSwitcher /></div>)
    const button = screen.getByRole('button', { name: 'Change language' })
    fireEvent.click(button)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('listbox')).toBeNull()
    fireEvent.click(button)
    fireEvent.mouseDown(screen.getByText('outside'))
    expect(screen.queryByRole('listbox')).toBeNull()
  })
})
