import { useMemo, useState, type MouseEvent } from 'react'
import { useMediaQuery } from '@mantine/hooks'
import { PHONE_QUERY } from '../../services/phoneConfig'
import { PickerHostContext, PickerSlotContext } from './pickerContext'
import { useTranslation } from 'react-i18next'
import { useStore } from '../../store'
import { features } from '../../features'
import {
  CONDITION_KEYS, DEFAULT_COMMUTE_MINUTES, SHORT_LABEL, activeConditions, commutePlace, strengthsFor,
  type ConditionKey, type SettingsPatch,
} from '../../services/conditionOptions'
import { SentenceRow } from './SentenceRow'
import { AddConditionChips } from './AddConditionChips'
import { MatchBar } from './MatchBar'

/** A condition: its number, short name and sentence, and under them the place where a word's picker opens. */
function ConditionRow({ condition, index, onRemove }: { condition: ConditionKey; index: number; onRemove: () => void }) {
  const { t } = useTranslation('editor')
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  const phone = useMediaQuery(PHONE_QUERY, false, { getInitialValueInEffect: false })
  // On a phone the words are smaller than a finger: a tap anywhere on the row opens the first picker.
  const tapRow = (e: MouseEvent<HTMLDivElement>) => {
    if (!phone || (e.target as HTMLElement).closest('button, .word-panel')) return
    e.currentTarget.querySelector<HTMLButtonElement>('.word-pill')?.click()
  }
  return (
    <div className="condition-row" onClick={tapRow}>
      <span className="condition-row__num" aria-label={t('editor.priority', { n: index + 1 })}>{index + 1}</span>
      <PickerSlotContext.Provider value={slot}>
        <div className="condition-row__main">
          <span className="condition-row__name">{SHORT_LABEL[condition]}</span>
          <SentenceRow condition={condition} />
          <div ref={setSlot} className="condition-row__panel" />
        </div>
      </PickerSlotContext.Provider>
      <button type="button" className="condition-row__remove" aria-label={t('editor.remove', { name: SHORT_LABEL[condition] })} onClick={onRemove}>
        ×
      </button>
    </div>
  )
}

/** The conditions as numbered sentences, "+ add" chips for the rest, and the match bar (TODO-031). */
export function ConditionsEditor() {
  const { t } = useTranslation('editor')
  const weights = useStore((s) => s.compositeWeights)
  const strengths = useStore((s) => s.compositeRiskStrengths)
  const order = useStore((s) => s.conditionOrder)
  // The daily trip (078) is on while it has a place: it is a filter, not a weight.
  const commute = useStore((s) => features.isochrone && s.workplace !== null)
  const applySettings = useStore((s) => s.applySettings)
  const [openId, setOpenId] = useState<string | null>(null)
  const active = useMemo(() => activeConditions(weights, strengths, order, commute), [weights, strengths, order, commute])
  const missing = CONDITION_KEYS.filter((k) => !active.includes(k)
    && (k !== 'localsOpinion' || features.localsOpinion) && (k !== 'commute' || features.isochrone))

  const change = (key: ConditionKey, on: boolean) => {
    const patch: SettingsPatch = { order: on ? [...active, key] : active.filter((k) => k !== key) }
    if (key === 'commute') {
      // A new trip goes to the centre in the default time; × drops the place and its commute zone.
      const st = useStore.getState()
      if (on) st.setMinutes(DEFAULT_COMMUTE_MINUTES)
      st.setWorkplace(on ? commutePlace() : null)
    } else if (key === 'risk') patch.riskStrengths = strengthsFor(on ? 'avoid' : 'off')
    else patch.weights = { ...weights, [key]: on ? 1 : 0 }
    applySettings(patch)
  }

  return (
    <PickerHostContext.Provider value={{ openId, setOpenId }}>
    <div className="conditions-editor">
      {active.length === 0 ? (
        <p className="conditions-editor__empty">{t('editor.empty')}</p>
      ) : (
        <div className="conditions-editor__rows">
          {active.map((k, i) => <ConditionRow key={k} condition={k} index={i} onRemove={() => change(k, false)} />)}
        </div>
      )}
      <AddConditionChips missing={missing} onAdd={(k) => change(k, true)} />
      <MatchBar />
    </div>
    </PickerHostContext.Provider>
  )
}
