import { Trans, useTranslation } from 'react-i18next'
import i18n from '../../i18n'
import { formatNumber } from '../../i18n/format'
import { useStore } from '../../store'
import { useBudgetShares } from '../../hooks/useBudgetShares'
import {
  BUDGET_OPTIONS, BUDGET_RANGE, CENTRE_OPTIONS, FLAT_AREA_OPTIONS, FLAT_AREA_RANGE, LOCALS_OPTIONS, NOISE_OPTIONS,
  WALK_OPTIONS, budgetFor, formatEuro, optionFor, priceForBudget, riskLevel, strengthsFor,
  type ConditionKey, type WordOption,
} from '../../services/conditionOptions'
import { CONDITION_RANGES, PRICE_FALLOFF_PCT, type Conditions } from '../../services/buildings/conditions'
import { AGE_ERAS } from '../../services/buildings/buildingAge'
import { LANDMARKS } from '../../services/cityCore/landmarks'
import { SERVICE_CATEGORIES } from '../../services/walkability/serviceCategories'
import { WordPicker } from './WordPicker'
import { OptionList, type Choice } from './OptionList'
import { CheckList } from './CheckList'

/** A number of a condition ("58 dB", "10 min") as a tappable word with verbal steps and a custom slider. */
function LimitWord({ field, options, title, note, format }: {
  field: keyof Conditions
  options: readonly WordOption[]
  title: string
  note?: string
  format: (v: number) => string
}) {
  const conditions = useStore((s) => s.conditions)
  const setConditions = useStore((s) => s.setConditions)
  const value = conditions[field]
  const set = (v: number) => setConditions({ ...conditions, [field]: v })
  const range = CONDITION_RANGES[field]
  return (
    <WordPicker label={optionFor(options, value)?.label ?? format(value)} title={title} note={note}>
      {(close) => (
        <OptionList
          options={options}
          value={value}
          onChange={(v) => { set(v); close() }}
          custom={{ ...range, format, onChange: set }}
        />
      )}
    </WordPicker>
  )
}

/** "70 m²": the size of the flat the budget is for. Another size keeps the budget in euros. */
function FlatAreaWord() {
  const { t } = useTranslation('editor')
  const area = useStore((s) => s.flatAreaM2)
  const setFlatArea = useStore((s) => s.setFlatArea)
  const format = (v: number) => i18n.t('conditions:unit.m2', { value: v })
  return (
    <WordPicker label={optionFor(FLAT_AREA_OPTIONS, area)?.label ?? format(area)} title={t('sentence.areaTitle')}>
      {(close) => (
        <OptionList
          options={FLAT_AREA_OPTIONS}
          value={area}
          onChange={(v) => { setFlatArea(v); close() }}
          custom={{ ...FLAT_AREA_RANGE, format, onChange: setFlatArea }}
        />
      )}
    </WordPicker>
  )
}

/**
 * "€250,000": what a flat of that size costs on average in the area. The data is the area's average price per
 * m², so the limit that is stored is the budget ÷ the size of the flat.
 */
function BudgetWord() {
  const { t } = useTranslation('editor')
  const conditions = useStore((s) => s.conditions)
  const setConditions = useStore((s) => s.setConditions)
  const area = useStore((s) => s.flatAreaM2)
  const share = useBudgetShares()
  const budget = budgetFor(conditions.priceMaxEurM2, area)
  const set = (b: number) => setConditions({ ...conditions, priceMaxEurM2: priceForBudget(b, area) })
  const options = BUDGET_OPTIONS.map((o) => ({
    ...o, hint: share ? t('sentence.budgetHint', { share: share(priceForBudget(o.value, area)) }) : undefined,
  }))
  return (
    <WordPicker
      label={optionFor(BUDGET_OPTIONS, budget)?.label ?? formatEuro(budget)}
      title={t('sentence.budgetTitle')}
      note={t('sentence.budgetNote', { pct: PRICE_FALLOFF_PCT })}
    >
      {(close) => (
        <OptionList
          options={options}
          value={budget}
          onChange={(v) => { set(v); close() }}
          custom={{ ...BUDGET_RANGE, format: formatEuro, onChange: set }}
        />
      )}
    </WordPicker>
  )
}

const dB = (v: number) => i18n.t('conditions:unit.db', { value: v })
const min = (v: number) => i18n.t('conditions:unit.min', { value: v })

function ServicesWord() {
  const { t } = useTranslation('editor')
  const selected = useStore((s) => s.enabledWalkCategories)
  const set = useStore((s) => s.setEnabledWalkCategories)
  const all = SERVICE_CATEGORIES.every((c) => selected.includes(c.id))
  const label = all ? t('sentence.servicesAll') : selected.length === 1
    ? SERVICE_CATEGORIES.find((c) => c.id === selected[0])?.label ?? t('sentence.servicesOne')
    : t('sentence.servicesMany', { count: selected.length })
  return (
    <WordPicker label={label} title={t('sentence.servicesTitle')}>
      {() => (
        <CheckList
          items={SERVICE_CATEGORIES.map((c) => ({ id: c.id, label: c.label }))}
          selected={selected}
          onChange={set}
          allLabel={t('sentence.servicesAllBox')}
        />
      )}
    </WordPicker>
  )
}

function PlacesWord() {
  const { t } = useTranslation('editor')
  const selected = useStore((s) => s.enabledLandmarkIds)
  const set = useStore((s) => s.setEnabledLandmarkIds)
  const all = LANDMARKS.every((l) => selected.includes(l.id))
  const label = all ? t('sentence.placesAll') : selected.length === 1
    ? LANDMARKS.find((l) => l.id === selected[0])?.name ?? t('sentence.placesOne')
    : t('sentence.placesMany', { count: selected.length })
  return (
    <WordPicker label={label} title={t('sentence.placesTitle')}>
      {() => (
        <CheckList
          items={LANDMARKS.map((l) => ({ id: l.id, label: l.name }))}
          selected={selected}
          onChange={set}
          allLabel={t('sentence.placesAllBox')}
        />
      )}
    </WordPicker>
  )
}

function ErasWord() {
  const { t } = useTranslation('editor')
  const selected = useStore((s) => s.ageEras)
  const set = useStore((s) => s.setAgeEras)
  const all = AGE_ERAS.every((e) => selected.includes(e.id))
  const label = all ? t('sentence.erasAll') : selected.length === 1
    ? AGE_ERAS.find((e) => e.id === selected[0])?.years ?? t('sentence.erasOne')
    : t('sentence.erasMany', { count: selected.length })
  return (
    <WordPicker label={label} title={t('sentence.erasTitle')}>
      {() => (
        <CheckList
          items={AGE_ERAS.map((e) => ({ id: e.id, label: e.name, hint: e.years }))}
          selected={selected}
          onChange={set}
          allLabel={t('sentence.erasAllBox')}
        />
      )}
    </WordPicker>
  )
}

function RiskWord() {
  const { t } = useTranslation('editor')
  const RISK_CHOICES: Choice<'avoid' | 'strong'>[] = [
    { value: 'avoid', label: t('sentence.avoid') },
    { value: 'strong', label: t('sentence.strong') },
  ]
  const strengths = useStore((s) => s.compositeRiskStrengths)
  const set = useStore((s) => s.setCompositeRiskStrengths)
  const level = riskLevel(strengths)
  const label = level === 'strong' ? t('sentence.strong') : level === 'custom' ? t('sentence.custom') : t('sentence.avoid')
  return (
    <WordPicker label={label} title={t('sentence.riskTitle')}>
      {(close) => (
        <OptionList
          options={RISK_CHOICES}
          value={level === 'avoid' || level === 'strong' ? level : ('custom' as 'avoid')}
          onChange={(v) => { set(strengthsFor(v)); close() }}
        />
      )}
    </WordPicker>
  )
}

/**
 * One condition as a sentence whose highlighted words are the controls (TODO-031). The sentence is one string of
 * the language files with the controls as tags (`<limit/>`), so each language puts them where its grammar wants.
 */
export function SentenceRow({ condition }: { condition: ConditionKey }) {
  useTranslation('editor') // render again when the language changes
  const sentence = (key: string, components: Record<string, React.ReactElement>) => (
    <p className="sentence"><Trans i18nKey={`sentence.${key}` as never} ns="editor" components={components} /></p>
  )
  switch (condition) {
    case 'noise':
      return sentence('noise', {
        limit: <LimitWord field="noiseMaxDb" options={NOISE_OPTIONS} title={i18n.t('editor:sentence.noiseTitle')} format={dB} />,
      })
    case 'poiAccess':
      return sentence('poiAccess', {
        services: <ServicesWord />,
        limit: <LimitWord field="walkMaxMin" options={WALK_OPTIONS} title={i18n.t('editor:sentence.walkTitle')} format={min} />,
      })
    case 'cityCore':
      return sentence('cityCore', {
        places: <PlacesWord />,
        limit: <LimitWord field="cityCoreMaxMin" options={CENTRE_OPTIONS} title={i18n.t('editor:sentence.centreTitle')} format={min} />,
      })
    case 'openPrice':
      return sentence('openPrice', { area: <FlatAreaWord />, budget: <BudgetWord /> })
    case 'localsOpinion':
      return sentence('localsOpinion', {
        limit: (
          <LimitWord field="localsMin" options={LOCALS_OPTIONS} title={i18n.t('editor:sentence.localsTitle')}
            format={(v) => formatNumber(v, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} />
        ),
      })
    case 'age':
      return sentence('age', { eras: <ErasWord /> })
    case 'risk':
      return sentence('risk', { level: <RiskWord /> })
  }
}
