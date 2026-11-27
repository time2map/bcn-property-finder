import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { act } from 'react'
import { setLanguage } from './index'
import { SentenceRow } from '../components/Conditions/SentenceRow'
import { noiseText, cityCoreText } from '../services/match/matchText'
import { PRESETS, profileName } from '../services/presets'
import { SHORT_LABEL } from '../services/conditionOptions'
import { CONDITION_LABEL } from '../services/match/matchSummary'
import { strongestLine } from '../services/areas/areaCardText'

// Integration: a language switch reaches the sentence editor, the generated texts and the profiles (TODO-065).
describe('translated UI', () => {
  afterEach(async () => { await act(async () => { await setLanguage('en') }) })

  it('puts the controls of a sentence where the language wants them', async () => {
    await act(async () => { await setLanguage('es') })
    render(<MantineProvider><SentenceRow condition="noise" /></MantineProvider>)
    expect(screen.getByText(/Con no más ruido que/)).toBeInTheDocument()
    expect(screen.getByText(/en la fachada exterior/)).toBeInTheDocument()
  })

  it('translates generated texts, with plurals', async () => {
    await act(async () => { await setLanguage('ca') })
    expect(noiseText(57, 65)).toBe('57 dB, per sota dels teus 65')
    expect(cityCoreText(1, 1, 30)).toContain('lloc')
    expect(cityCoreText(3, 13, 30)).toContain('llocs')
  })

  it('names the noise condition by noise, not by a broad "tranquilo" (TODO-074)', async () => {
    await act(async () => { await setLanguage('es') })
    expect(SHORT_LABEL.noise).toBe('Poco ruido')
    expect(CONDITION_LABEL.noise).toBe('Poco ruido')
    expect(strongestLine(['noise'])).toBe('Lo mejor: poco ruido')
    await act(async () => { await setLanguage('ca') })
    expect(SHORT_LABEL.noise).toBe('Poc soroll')
    expect(CONDITION_LABEL.noise).toBe('Poc soroll')
    expect(strongestLine(['noise'])).toBe('El millor: poc soroll')
  })

  it('names the profiles in the page language', async () => {
    await act(async () => { await setLanguage('es') })
    expect(PRESETS.map(profileName)).toEqual(['Familia', 'Teletrabajo', 'Vida urbana', 'Persona jubilada'])
  })
})
