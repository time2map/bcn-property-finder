import { describe, it, expect, beforeEach } from 'vitest'
import { useIdealistaBaseUrlStore } from './idealistaBaseUrlStore'

describe('useIdealistaBaseUrlStore', () => {
  beforeEach(() => {
    useIdealistaBaseUrlStore.setState({ baseUrl: null })
    localStorage.clear()
  })

  it('starts with null baseUrl', () => {
    expect(useIdealistaBaseUrlStore.getState().baseUrl).toBeNull()
  })

  it('setBaseUrl updates state', () => {
    useIdealistaBaseUrlStore.getState().setBaseUrl('https://www.idealista.com/en/areas/venta-viviendas/')
    expect(useIdealistaBaseUrlStore.getState().baseUrl).toBe('https://www.idealista.com/en/areas/venta-viviendas/')
  })

  it('setBaseUrl persists to localStorage', () => {
    useIdealistaBaseUrlStore.getState().setBaseUrl('https://www.idealista.com/en/areas/venta-viviendas/')
    expect(localStorage.getItem('bcn_idealista_base_url')).toBe('https://www.idealista.com/en/areas/venta-viviendas/')
  })

  it('clearBaseUrl resets to null', () => {
    useIdealistaBaseUrlStore.getState().setBaseUrl('https://www.idealista.com/en/areas/venta-viviendas/')
    useIdealistaBaseUrlStore.getState().clearBaseUrl()
    expect(useIdealistaBaseUrlStore.getState().baseUrl).toBeNull()
  })

  it('clearBaseUrl removes from localStorage', () => {
    useIdealistaBaseUrlStore.getState().setBaseUrl('https://www.idealista.com/en/areas/venta-viviendas/')
    useIdealistaBaseUrlStore.getState().clearBaseUrl()
    expect(localStorage.getItem('bcn_idealista_base_url')).toBeNull()
  })
})
