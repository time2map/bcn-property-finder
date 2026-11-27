import { useTranslation } from 'react-i18next'
import type { AreaRank } from '../../services/areas/areaRank'
import { SHORT_LABEL } from '../../services/conditionOptions'


/** One area of the list: rank, name, how many homes fit, and what the area is best at. */
export function AreaRow({ rank, position, showKind = true, onPick }: {
  rank: AreaRank
  position: number
  /** Hidden inside the "Barcelona" / "Metro area" sections, where the kind is the heading. */
  showKind?: boolean
  /** Undefined when the area has no polygon to fly to. */
  onPick?: (rank: AreaRank) => void
}) {
  const { t } = useTranslation('card')
  const pct = Math.round(rank.shareGood)
  return (
    <button
      type="button"
      className="area-row"
      disabled={!onPick}
      onClick={() => onPick?.(rank)}
      aria-label={t('areasList.rowAria', { pos: position, name: rank.name, pct })}
    >
      <span className="area-row__rank" aria-hidden="true">{position}</span>
      <span className="area-row__body">
        <span className="area-row__head">
          <b>{rank.name}</b>
          {showKind && <span className="area-row__kind">{rank.kind === 'barri' ? t('area.kindBarri') : t('area.kindMuni')}</span>}
        </span>
        <span className="area-row__text">{t('areasList.rowText', { pct })}</span>
        <span className="area-row__bar" aria-hidden="true"><i style={{ width: `${pct}%` }} /></span>
        {rank.strongest.length > 0 && (
          <span className="area-row__chips">
            {rank.strongest.map((k) => <span key={k} className="area-row__chip">{SHORT_LABEL[k].toLocaleLowerCase()}</span>)}
          </span>
        )}
      </span>
    </button>
  )
}
