import { useTranslation } from 'react-i18next'
import { Button, Switch } from '@mantine/core'
import { useStore } from '../../store'
import { useFunnel } from '../../hooks/useFunnel'
import { FUNNEL_CONFIG } from '../../services/funnel/funnelConfig'
import { topPercent } from '../../services/funnel/funnel'
import { formatValue } from '../../services/funnel/funnelWishes'
import { buildingArea } from '../../services/buildings/buildingScore'

/**
 * "Find your one building" (TODO-076), a technical prototype: pick wishes in order of importance, each pick keeps the
 * best of the homes still in play, five picks end at a spot of a few homes and one of them. Opened with `?funnel`.
 */
export function FunnelPanel() {
  const { t, i18n } = useTranslation('funnel')
  const picks = useStore((s) => s.funnelPicks)
  const sea = useStore((s) => s.funnelSea)
  const pick = useStore((s) => s.pickFunnelWish)
  const undo = useStore((s) => s.undoFunnelWish)
  const reset = useStore((s) => s.resetFunnel)
  const setSea = useStore((s) => s.setFunnelSea)
  const close = useStore((s) => s.setFunnelOpen)
  const select = useStore((s) => s.setSelectedBuilding)
  const { loaded, error, run, offers, done, result } = useFunnel()
  const num = (n: number) => n.toLocaleString(i18n.language)

  const header = (
    <div className="funnel-panel__top">
      <h2>{t('title')} <span className="funnel-panel__badge">{t('badge')}</span></h2>
      <button type="button" className="funnel-panel__link" onClick={() => close(false)}>{t('close')}</button>
    </div>
  )

  if (error || !loaded || !run) {
    return (
      <section className="funnel-panel glass-panel" aria-label={t('title')}>
        {header}
        <p className="funnel-panel__sub">{error ? t('error') : t('loading')}</p>
      </section>
    )
  }

  const { fd, buildings } = loaded
  const start = run.steps[0]?.before ?? run.alive.length
  const winnerRow = result && result.winner >= 0 ? fd.rows[result.winner] : null
  const barri = winnerRow !== null ? buildingArea(buildings, winnerRow)?.name ?? '' : ''

  return (
    <section className="funnel-panel glass-panel" aria-label={t('title')}>
      {header}
      {picks.length === 0 && <p className="funnel-panel__sub">{t('intro', { homes: num(start) })}</p>}
      <Switch
        size="sm"
        label={t('sea')}
        checked={sea}
        onChange={(e) => setSea(e.currentTarget.checked)}
      />

      <ol className="funnel-panel__path" aria-label={t('left', { count: run.alive.length })}>
        <li className="funnel-panel__count">{num(start)}</li>
        {run.steps.map((s) => (
          <li key={s.wish}>
            <span className="funnel-panel__count">{num(s.after)}</span>
            <span className="funnel-panel__wish">{t(`wish.${s.wish}`)}</span>
            <span className="funnel-panel__fact">{t(`fact.${s.wish}`, { value: formatValue(s.wish, s.threshold, i18n.language) })}</span>
          </li>
        ))}
      </ol>

      {!done && (
        <>
          <p className="funnel-panel__prompt">
            {run.steps.length === 0 ? t('promptFirst') : t('promptNext')}{' '}
            <span className="funnel-panel__step">{t('step', { n: run.steps.length + 1, total: FUNNEL_CONFIG.steps })}</span>
          </p>
          <div className="funnel-panel__wishes">
            {offers.map(({ wish, cuts }) => (
              <button
                key={wish}
                type="button"
                className="funnel-panel__wish-btn"
                disabled={!cuts}
                title={cuts ? undefined : t('cannotCut')}
                onClick={() => pick(wish)}
              >
                {t(`wish.${wish}`)}
              </button>
            ))}
          </div>
        </>
      )}

      {done && result && winnerRow !== null && (
        <div className="funnel-panel__result" role="status">
          <h3>{t('result.title', { barri })}</h3>
          <p className="funnel-panel__sub">{t('result.winner')}</p>
          <ul className="funnel-panel__ranks">
            {result.pct.map((p) => (
              <li key={p.wish}>
                <span>{t(`wish.${p.wish}`)}</span>
                <span>{t('result.rank', { n: topPercent(p.pct) })}</span>
              </li>
            ))}
          </ul>
          {result.spot.length > 0 && <p className="funnel-panel__sub">{t('result.near', { count: result.spot.length })}</p>}
          <Button size="sm" onClick={() => select(winnerRow)}>{t('result.open')}</Button>
          <p className="funnel-panel__note">{t('result.note')}</p>
        </div>
      )}

      <div className="funnel-panel__actions">
        <button type="button" className="funnel-panel__link" disabled={picks.length === 0} onClick={undo}>{t('back')}</button>
        <button type="button" className="funnel-panel__link" disabled={picks.length === 0 && !sea} onClick={reset}>{t('restart')}</button>
      </div>
    </section>
  )
}
