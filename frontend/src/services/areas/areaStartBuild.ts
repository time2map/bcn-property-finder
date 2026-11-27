import type { AreaFeature } from '../areas'
import { addLazyColumns, COLUMN_FILES, type BuildingsMeta, type ColumnFile } from '../buildings/buildingData'
import { features } from '../../features'
import type { BarriVibeData } from '../localsOpinion/localsOpinion'
import { computeAreaStart, type AreaStart } from './areaStart'

/** Inputs as files (scripts/build-area-start.mjs reads them; the column files already decompressed). */
export interface AreaStartFiles {
  meta: BuildingsMeta
  columns: Record<ColumnFile, ArrayBuffer | undefined>
  areas: { features: AreaFeature[] }
  vibe: BarriVibeData | null
}

export { COLUMN_FILES }

/** area-start.json for the data files, with the feature flags of this build (locals' opinion data only when on). */
export function buildAreaStart(files: AreaStartFiles): AreaStart {
  const { meta } = files
  const data = { meta, count: meta.count, cols: addLazyColumns({}, meta, files.columns) }
  return computeAreaStart(data, files.areas.features, features.localsOpinion ? files.vibe : null)
}
