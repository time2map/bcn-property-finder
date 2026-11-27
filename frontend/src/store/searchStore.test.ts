import { describe, it, expect, beforeEach } from 'vitest'
import { useSearchStore } from './searchStore'

const outline = { type: 'FeatureCollection', features: [] } as const

describe('searchStore', () => {
  beforeEach(() => { useSearchStore.getState().clear(); useSearchStore.setState({ open: false }) })

  it('starts empty', () => {
    expect(useSearchStore.getState().selection).toBeNull()
  })

  it('stores an area selection', () => {
    useSearchStore.getState().selectArea('El Born', [1, 2, 3, 4], outline as never)
    const s = useSearchStore.getState().selection
    expect(s).toMatchObject({ kind: 'area', label: 'El Born', bounds: [1, 2, 3, 4] })
  })

  it('stores an address selection and replaces the previous one', () => {
    const st = useSearchStore.getState()
    st.selectArea('El Born', [1, 2, 3, 4], outline as never)
    st.selectAddress('Carrer X 1', [2.1, 41.4])
    expect(useSearchStore.getState().selection).toMatchObject({ kind: 'address', coords: [2.1, 41.4] })
  })

  it('gives every selection a new request id so picking the same place again re-centres the map', () => {
    const st = useSearchStore.getState()
    st.selectAddress('A', [1, 1])
    const a = useSearchStore.getState().selection!.requestId
    st.selectAddress('A', [1, 1])
    expect(useSearchStore.getState().selection!.requestId).not.toBe(a)
  })

  it('clears', () => {
    useSearchStore.getState().selectAddress('A', [1, 1])
    useSearchStore.getState().clear()
    expect(useSearchStore.getState().selection).toBeNull()
  })

  it('the search field is closed at first; closing it also drops the picked place', () => {
    const st = useSearchStore.getState()
    expect(st.open).toBe(false)
    st.setOpen(true)
    st.selectAddress('Carrer X 1', [2.1, 41.4])
    expect(useSearchStore.getState().open).toBe(true)
    expect(useSearchStore.getState().selection).not.toBeNull()
    useSearchStore.getState().setOpen(false)
    expect(useSearchStore.getState().open).toBe(false)
    expect(useSearchStore.getState().selection).toBeNull()
  })
})
