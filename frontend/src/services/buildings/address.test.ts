import { describe, it, expect } from 'vitest'
import { catastroUrl, facadePhotoUrl, prettyAddress, prettyAddresses } from './address'

describe('Catastro address and links (TODO-046)', () => {
  it('expands street types, title-cases names, keeps small words lower case', () => {
    expect(prettyAddress('CL ARAGO 255; RB CATALUNYA 30')).toBe('Carrer Arago 255 · Rambla Catalunya 30')
    expect(prettyAddress('PS DE GRACIA 92')).toBe('Passeig de Gracia 92')
    expect(prettyAddress('CL LA RIERA S-N')).toBe('Carrer la Riera s/n')
    expect(prettyAddress('XX NOU 3')).toBe('Xx Nou 3')
    expect(prettyAddress(undefined)).toBeNull()
  })

  it('builds the Catastro page and photo URLs from the reference', () => {
    expect(catastroUrl('0123456DF2802C')).toContain('rc1=0123456&rc2=DF2802C')
    expect(facadePhotoUrl('0123456DF2802C')).toMatch(/RecuperarFotoFachadaGet\?ReferenciaCatastral=0123456DF2802C$/)
  })
})

describe('prettyAddresses', () => {
  it('splits a building with several addresses', () => {
    expect(prettyAddresses('CL ARAGO 255; RB CATALUNYA 30; CL DIPUTACIO 1')).toEqual(['Carrer Arago 255', 'Rambla Catalunya 30', 'Carrer Diputacio 1'])
  })
  it('is empty without an address', () => {
    expect(prettyAddresses(undefined)).toEqual([])
    expect(prettyAddresses('')).toEqual([])
  })
})
