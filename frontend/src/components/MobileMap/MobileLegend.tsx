import { useTranslation } from 'react-i18next'
import { useStore } from '../../store'
import { hasConditions } from '../../services/composite/compositeScore'
import { BAND_COLOR, BAND_ORDER } from '../../services/match/matchSummary'
import { features } from '../../features'
import { RAMP_GRADIENT } from '../BuildingsLayer/CompositeLegend'

/**
 * The colour scale on the map itself (TODO-062): the four match bands, or with an isochrone the worse → better
 * gradient of the commute zone (077).
 * Hidden while the map is neutral (061) or match colours are off.
 */
export function MobileLegend() {
  const { t } = useTranslation('panel')
  const visible = useStore((s) => s.compositeVisible && hasConditions(s.compositeWeights, s.compositeRiskStrengths))
  const stretched = useStore((s) => features.isochrone && s.resultPolygon !== null)
  if (!visible) return <span />
  if (stretched) {
    return (
      <div className="mobile-legend" aria-label={t('legend.scale')}>
        <span>{t('legend.worse')}</span>
        <i className="mobile-legend__ramp" style={{ background: RAMP_GRADIENT }} />
        <span>{t('legend.better')}</span>
      </div>
    )
  }
  return (
    <ul className="mobile-legend" aria-label={t('legend.bands')}>
      {BAND_ORDER.map((band) => (
        <li key={band}><i style={{ background: BAND_COLOR[band] }} />{t(`legend.${band}`)}</li>
      ))}
    </ul>
  )
}
