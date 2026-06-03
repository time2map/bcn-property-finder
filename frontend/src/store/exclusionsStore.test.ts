import { describe, it, expect, beforeEach } from 'vitest'
import type { Polygon } from 'geojson'
import { useExclusionsStore, EXCLUSIONS_STORAGE_KEY } from './exclusionsStore'

const GEOM: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ],
  ],
}

describe('exclusionsStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useExclusionsStore.setState({ zones: [] })
  })

  it('adds a drawn zone and returns its id', () => {
    const id = useExclusionsStore.getState().addZone({ name: 'My zone', source: 'drawn', geometry: GEOM })
    const { zones } = useExclusionsStore.getState()
    expect(zones).toHaveLength(1)
    expect(zones[0].id).toBe(id)
    expect(zones[0].name).toBe('My zone')
    expect(zones[0].source).toBe('drawn')
  })

  it('persists zones to localStorage', () => {
    useExclusionsStore.getState().addZone({ name: 'Z', source: 'area', areaId: 'barri-1', geometry: GEOM })
    const raw = localStorage.getItem(EXCLUSIONS_STORAGE_KEY)
    expect(raw).toBeTruthy()
    expect(JSON.parse(raw!)).toHaveLength(1)
  })

  it('does not add a duplicate area zone (same areaId)', () => {
    const { addZone } = useExclusionsStore.getState()
    addZone({ name: 'Gràcia', source: 'area', areaId: 'district-6', geometry: GEOM })
    addZone({ name: 'Gràcia', source: 'area', areaId: 'district-6', geometry: GEOM })
    expect(useExclusionsStore.getState().zones).toHaveLength(1)
  })

  it('removes a zone by id', () => {
    const id = useExclusionsStore.getState().addZone({ name: 'Z', source: 'drawn', geometry: GEOM })
    useExclusionsStore.getState().removeZone(id)
    expect(useExclusionsStore.getState().zones).toHaveLength(0)
  })

  it('clears all zones', () => {
    const { addZone } = useExclusionsStore.getState()
    addZone({ name: 'A', source: 'drawn', geometry: GEOM })
    addZone({ name: 'B', source: 'drawn', geometry: GEOM })
    useExclusionsStore.getState().clearZones()
    expect(useExclusionsStore.getState().zones).toHaveLength(0)
  })
})
