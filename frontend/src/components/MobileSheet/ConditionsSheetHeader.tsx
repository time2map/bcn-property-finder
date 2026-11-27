import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store'
import { useSheetStore } from '../../store/sheetStore'
import { features } from '../../features'
import { conditionNames } from '../../services/match/conditionNames'

/**
 * What the sheet shows above the fold in the conditions view (TODO-062): the conditions that are on, or, after an
 * area was picked from the list, that area with a way back to the list.
 */
export function ConditionsSheetHeader() {
  const { t } = useTranslation('editor')
  const weights = useStore((s) => s.compositeWeights)
  const risks = useStore((s) => s.compositeRiskStrengths)
  const position = useSheetStore((s) => s.position)
  const tab = useSheetStore((s) => s.tab)
  const picked = useSheetStore((s) => s.pickedArea)
  const backToList = useSheetStore((s) => s.backToList)
  const openOnboarding = useStore((s) => s.openOnboarding)
  const names = useMemo(() => conditionNames(weights, risks), [weights, risks])
  const peek = position === 'peek'

  if (picked && peek) {
    return (
      <div className="sheet-header sheet-header--row">
        <div className="sheet-header__text">
          <div className="sheet-header__title">{picked.name}</div>
          <div className="sheet-header__sub">{t('sheet.pickedSub', { share: picked.share })}</div>
        </div>
        <button type="button" className="sheet-header__action" onClick={backToList}>{t('sheet.backToList')}</button>
      </div>
    )
  }

  // Open: the tabs below already name the view, so no second title; one short line (or one row) is all that is left.
  if (tab === 'areas') {
    if (!peek) return <div className="sheet-header sheet-header--open"><div className="sheet-header__sub">{t('sheet.rankedBy')}</div></div>
    return (
      <div className="sheet-header">
        <div className="sheet-header__title">{t('sheet.areasTitle')}</div>
        <div className="sheet-header__sub">{t('sheet.swipeList')}</div>
      </div>
    )
  }

  if (!peek) {
    return (
      <div className="sheet-header sheet-header--row sheet-header--open">
        <div className="sheet-header__title">{t('sheet.conditionsTitle')}</div>
        {features.onboarding && (
          <button type="button" className="sheet-header__link" onClick={openOnboarding}>{t('yourConditions.change')}</button>
        )}
      </div>
    )
  }

  const list = names.length > 0 ? names.join(' · ') : t('sheet.none')
  return (
    <div className="sheet-header">
      <div className="sheet-header__title">{list}</div>
      <div className="sheet-header__sub">{names.length > 0 ? t('sheet.swipeChange') : t('sheet.swipeAdd')}</div>
    </div>
  )
}
