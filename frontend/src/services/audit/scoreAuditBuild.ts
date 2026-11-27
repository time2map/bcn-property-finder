import { addLazyColumns, type BuildingsMeta, type ColumnFile } from '../buildings/buildingData'
import { firstVisitSettings } from '../buildings/firstVisit'
import type { BarriVibeData } from '../localsOpinion/localsOpinion'
import { PRESETS } from '../presets'
import { scoreSettingsOfProfile } from '../shareImage/shareImageBuild'
import { features } from '../../features'
import { auditSettings, guard, type AuditResult, type GuardRule } from './scoreAudit'

export { COLUMN_FILES } from '../buildings/buildingData'

/** The audit of the first-visit settings and of every profile, from the data files (scripts/score-audit.mjs). */
export function runAudit(files: {
  meta: BuildingsMeta
  columns: Record<ColumnFile, ArrayBuffer | undefined>
  vibe: BarriVibeData | null
}): { name: string; result: AuditResult; guard: GuardRule }[] {
  const data = { meta: files.meta, count: files.meta.count, cols: addLazyColumns({}, files.meta, files.columns) }
  const vibe = features.localsOpinion ? files.vibe : null
  const runs = [
    { name: 'first visit', settings: firstVisitSettings() },
    ...PRESETS.map((p) => ({ name: `profile ${p.id}`, settings: scoreSettingsOfProfile(p) })),
  ]
  return runs.map(({ name, settings }) => {
    const result = auditSettings(data, { ...settings, vibe })
    return { name, result, guard: guard(result) }
  })
}
