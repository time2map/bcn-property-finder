import i18n from '../../i18n'
import type { ClimateRiskProps } from '../../services/climateRisk/climateRisk'

/** Wildfire line of the building card (036): the WUI gates the risk, the nearest rated forest explains it. */
export function fireText(climate: Pick<ClimateRiskProps, 'fire_wui' | 'fire_class' | 'fire_dist_m'>): string {
  if (!climate.fire_wui) return i18n.t('card:fire.notWui')
  if (climate.fire_class == null || climate.fire_dist_m == null) return i18n.t('card:fire.noForest')
  return i18n.t('card:fire.forest', { cls: climate.fire_class, dist: climate.fire_dist_m })
}
