import bbox from '@turf/bbox'
import type { AreaFeature } from '../areas'
import type { Bounds } from '../bestZones'
import { useStore } from '../../store'
import { useSearchStore } from '../../store/searchStore'

/**
 * Fly to an area and outline it: the same selection the search box makes (SearchLayer draws it). With the `index`
 * of the area (`AreaRank.index`) its card opens too (TODO-064).
 */
export function selectAreaFeature(feature: AreaFeature, index?: number): void {
  if (index !== undefined) useStore.getState().setSelectedArea(index)
  useSearchStore.getState().selectArea(
    feature.properties.name,
    bbox(feature) as Bounds,
    { type: 'FeatureCollection', features: [feature] },
  )
}
