import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store'
import { hasConditions } from '../../services/composite/compositeScore'
import { useAreaJoin } from '../../hooks/useAreaJoin'
import { selectAreaFeature } from '../../services/areas/areaSelect'
import type { AreaRank } from '../../services/areas/areaRank'
import type { AreaFeature } from '../../services/areas'
import { AreaRow } from './AreaRow'

/** Areas shown at first: all of Barcelona's districts matter more than the metro-area towns. */
const TOP = { barri: 10, muni: 5 } as const

function Section({ id, title, ranks, join, onPick }: {
  id: 'barri' | 'muni'
  title: string
  ranks: AreaRank[]
  join: Map<number, AreaFeature> | null
  onPick: (r: AreaRank) => void
}) {
  const { t } = useTranslation('card')
  const [showAll, setShowAll] = useState(false)
  if (ranks.length === 0) return null
  const top = TOP[id]
  const all = showAll || ranks.length <= top
  const shown = all ? ranks : ranks.slice(0, top)
  return (
    <section className="areas-list__section" aria-label={title}>
      <div className="areas-list__section-head">
        <h3>{title}</h3>
        <span>{all ? t('areasList.all', { n: ranks.length }) : t('areasList.top', { top, n: ranks.length })}</span>
      </div>
      {shown.map((r, i) => (
        <AreaRow key={r.index} rank={r} position={i + 1} showKind={false} onPick={join?.has(r.index) ? onPick : undefined} />
      ))}
      {!all && (
        <button type="button" className="areas-list__more" onClick={() => setShowAll(true)}>
          {t('areasList.showAll', { n: ranks.length })}
        </button>
      )}
    </section>
  )
}

/**
 * "Your areas" (TODO-051, 052): the areas ranked by the share of their homes that fit the conditions, in two
 * sections: the barris of Barcelona and the towns of the metro area.
 */
export function AreasList() {
  const { t } = useTranslation('card')
  const ranks = useStore((s) => s.areaRanks)
  const join = useAreaJoin()
  const anyCondition = useStore((s) => hasConditions(s.compositeWeights, s.compositeRiskStrengths))

  if (!anyCondition) return <p className="areas-list__note">{t('areasList.addCondition')}</p>
  if (!ranks) return <p className="areas-list__note">{t('areasList.scoring')}</p>
  const ranked = ranks.filter((r) => r.ranked)
  const small = ranks.filter((r) => !r.ranked)
  if (ranked.length === 0) return <p className="areas-list__note">{t('areasList.noneYet')}</p>

  const pick = (r: AreaRank) => {
    const feature = join?.get(r.index)
    if (!feature) return
    // The card of the area opens (TODO-064); on a phone it sits in the sheet at peek, so the area stays on the map.
    selectAreaFeature(feature, r.index)
  }
  return (
    <div className="areas-list">
      <p className="areas-list__note">{t('areasList.byShare')}</p>
      {/* The note above stays put; the sections and the small print scroll together. */}
      <div className="areas-list__rows">
        <Section id="barri" title={t('area.barcelona')} ranks={ranked.filter((r) => r.kind === 'barri')} join={join} onPick={pick} />
        <Section id="muni" title={t('area.metro')} ranks={ranked.filter((r) => r.kind === 'muni')} join={join} onPick={pick} />
        {small.length > 0 && (
          <p className="areas-list__small">
            {t('areasList.tooFew', { names: small.map((r) => r.name).join(', ') })}
          </p>
        )}
      </div>
    </div>
  )
}
