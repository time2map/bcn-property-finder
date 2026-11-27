import { IconBuilding, IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Text } from '@mantine/core'
import i18n from '../../i18n'
import { formatNumber } from '../../i18n/format'
import type { BuildingArea } from '../../services/buildings/buildingData'
import type { BuildingDetail, BuildingDetailResult } from '../../services/buildings/buildingDetail'
import { catastroUrl, facadePhotoUrl, prettyAddress } from '../../services/buildings/address'
import { UNCERTAIN_YEAR, eraOf } from '../../services/buildings/buildingAge'
import { belowGroundUses, loadCatastroUnits } from '../../services/buildings/catastroUnits'
import type { ComponentScores, CompositeWeights } from '../../services/composite/compositeScore'
import type { Conditions } from '../../services/buildings/conditions'
import type { BarriVibe, BarriVibeData } from '../../services/localsOpinion/localsOpinion'
import { PRICE_FALLOFF_PCT, priceOverPct } from '../../services/buildings/conditions'
import { features } from '../../features'
import { LocalsSay, LandmarkRow, NoiseBar, NoiseLabel, RiskRow } from './cardParts'
import { scoreColor } from './cardColors'
import { fireText } from './cardText'
import { countWithin, doorWaterText, noiseVsLimit, priceVsBudget, quietSide, ratingVsMin, riverText, sideText } from './buildingCardText'

const fmt = (n: number) => formatNumber(n, { maximumFractionDigits: 0 })

/** How the building's era relates to the eras the user likes, from its age score. */
function ageMatch(score: number): string {
  if (score === 0) return i18n.t('card:ageMatch.none')
  if (score === 100) return i18n.t('card:ageMatch.full')
  return i18n.t('card:ageMatch.edge')
}

export type SectionId = 'walk' | 'noise' | 'core' | 'risk' | 'price' | 'locals' | 'building'
const OPEN_BY_DEFAULT: Record<SectionId, boolean> = { walk: false, noise: false, core: false, risk: false, price: false, locals: false, building: false }

/**
 * One section of the details (TODO-072): a small ring with the section's score, the title with a one-line verdict
 * and a chevron. A tap opens the body; a section without a body is a plain row.
 */
function Section({ title, score, lead, verdict, open, onToggle, children, note }: {
  title: string
  /** The section's score (0–100); null = no condition behind it. */
  score?: number | null
  /** Replaces the ring (Climate risk: the points lost). */
  lead?: ReactNode
  verdict?: ReactNode
  open?: boolean
  onToggle?: () => void
  children?: ReactNode
  /** Under the row, aligned with the text, always visible. */
  note?: ReactNode
}) {
  const ring = lead ?? (
    <span className="section-ring" data-empty={score == null}
      style={score != null ? { '--ring-color': scoreColor(score), '--ring-pct': `${score}%` } as React.CSSProperties : undefined}>
      <span>{score ?? '–'}</span>
    </span>
  )
  const head = (
    <>
      {ring}
      <span className="section-row__text">
        <b>{title}</b>
        {verdict && <span>{verdict}</span>}
      </span>
      {onToggle && (open ? <IconChevronDown size={18} stroke={2} aria-hidden /> : <IconChevronRight size={18} stroke={2} aria-hidden />)}
    </>
  )
  return (
    <div className="section" data-testid={`section-${title}`}>
      {onToggle
        ? <button type="button" className="section-row" aria-expanded={open} onClick={onToggle}>{head}</button>
        : <div className="section-row section-row--static">{head}</div>}
      {note && <div className="section-body section-body--note">{note}</div>}
      {onToggle && open && children && <div className="section-body">{children}</div>}
    </div>
  )
}

function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="key-value">
      {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
    </dl>
  )
}

function Fact({ value, label }: { value: ReactNode; label: string }) {
  return <div className="facts-strip__item"><b>{value}</b><span>{label}</span></div>
}

/** The photo and the Catastro facts: four numbers in a row, the rest wraps under them. */
function BuildingStrip({ d }: { d: BuildingDetail }) {
  const { t } = useTranslation('card')
  const { t: tl } = useTranslation('legal')
  const other = (d.units ?? 0) - (d.dwellings ?? 0)
  const [below, setBelow] = useState<{ ref: string; uses: string[] } | null>(null)

  // What the floors below ground are (car park, storage, flats) — INSPIRE only counts them.
  useEffect(() => {
    if (!d.floors_below) return
    let cancelled = false
    loadCatastroUnits(d.id)
      .then((units) => { if (!cancelled) setBelow({ ref: d.id, uses: belowGroundUses(units) }) })
      .catch((err) => console.warn('Catastro units failed to load', err))
    return () => { cancelled = true }
  }, [d.id, d.floors_below])
  const belowUses = below?.ref === d.id ? below.uses : []

  return (
    <div className="building-strip">
      {features.facadePhoto && (
        <div className="building-strip__photo">
          <img src={facadePhotoUrl(d.id)} alt={t('ui.photoAlt', { address: prettyAddress(d.address) ?? t('ui.photoAltFallback') })}
            onError={(e) => { e.currentTarget.style.display = 'none' }} />
          <Text size="xs" c="dimmed" style={{ fontSize: 11 }}>{t('ui.photoCredit')}</Text>
        </div>
      )}
      <div className="facts-strip">
        {d.dwellings !== undefined && <Fact value={d.dwellings} label={t('facts.dwellingsLabel', { count: d.dwellings })} />}
        {d.floors !== undefined && <Fact value={d.floors} label={t('facts.floorsLabel', { count: d.floors })} />}
        {d.year_built !== undefined && <Fact value={d.year_built} label={eraOf(d.year_built).name} />}
        {d.area_m2 !== undefined && <Fact value={`${fmt(d.area_m2)} m²`} label={t('facts.builtAreaLabel')} />}
        {d.floors_below ? <Fact value={`+${d.floors_below}`} label={t('facts.belowLabel')} /> : null}
        {d.year_renov ? <Fact value={d.year_renov} label={t('facts.renovatedLabel')} /> : null}
        {d.condition && d.condition !== 'functional' && <Fact value={d.condition} label={t('facts.condition')} />}
        {other > 0 && <Fact value={other} label={t('facts.otherLabel')} />}
      </div>
      {belowUses.length > 0 && <Text size="xs" c="dimmed">{t('facts.belowGround')}: {belowUses.join(', ')}</Text>}
      {d.year_built === UNCERTAIN_YEAR && <Text size="xs" c="dimmed">{t('facts.uncertain')}</Text>}
      {other > 0 && <Text size="xs" c="dimmed">{t('facts.otherPremises')}</Text>}
      {/* Credit and "not official" (Catastro licence, TODO-066) */}
      <Text size="xs" c="dimmed">{tl('context.catastro')}</Text>
      <a className="text-link" href={catastroUrl(d.id)} target="_blank" rel="noopener noreferrer">{t('ui.openCatastro')}</a>
    </div>
  )
}

function NoiseBody({ d, facades, limit }: { d: BuildingDetail; facades: BuildingDetailResult['facades']; limit: number }) {
  const { t } = useTranslation('card')
  const { t: tl } = useTranslation('legal')
  const [facadesOpen, setFacadesOpen] = useState(false)
  if (d.lden_avg === undefined) return <Text size="xs" c="dimmed">{t('noise.noMap')}</Text>
  const sica = d.noise_src === 'sica_2022'
  const approx = sica ? '≈ ' : ''
  // The level the condition is checked against (TODO-073): the street side, else every facade.
  const street = d.lden_street !== undefined
  const lden = d.lden_street ?? d.lden_avg
  const ln = street ? d.ln_street : d.ln_avg
  const quiet = quietSide(d, limit)
  const groups = [...facades].sort((a, b) => b.lden - a.lden)
  const hasFacades = groups.length > 0 || (d.f17_lden_max ?? 0) > 0 || (d.f17_leisure_ln_max ?? 0) > 0
  return (
    <div className="noise-body">
      <div className="noise-body__top">
        <b className="noise-body__db">{approx}{Math.round(lden)} dB</b>
        <NoiseLabel lden={lden} />
      </div>
      <Text size="xs" c="dimmed">
        {t(street ? 'noise.scoredStreet' : 'noise.scoredAll', { approx, db: Math.round(lden) })}
        {ln !== undefined && t('noise.night', { ln: Math.round(ln) })}
      </Text>
      {quiet !== null && (
        <Text size="xs" data-testid="quiet-side">{t('noise.quietSide', { approx, db: Math.round(quiet) })}</Text>
      )}
      <NoiseBar lden={lden} />
      <Text size="xs" c="dimmed">{t('noise.who')}</Text>
      {[sideText('street', d.lden_street, d.ln_street), sideText('inner', d.lden_inner, d.ln_inner)]
        .filter((line): line is string => line !== null)
        .map((line) => <Text key={line} size="xs">{approx}{line}</Text>)}
      {d.lden_max !== undefined && d.lden_min !== undefined && (
        <Text size="xs">{t('noise.extremes', { max: Math.round(d.lden_max), min: Math.round(d.lden_min) })}</Text>
      )}
      {hasFacades && (
        <>
          <button type="button" className="sub-toggle" aria-expanded={facadesOpen} onClick={() => setFacadesOpen((o) => !o)}>
            {t('noise.facadeByFacade')}
            {facadesOpen ? <IconChevronDown size={16} stroke={2} aria-hidden /> : <IconChevronRight size={16} stroke={2} aria-hidden />}
          </button>
          {facadesOpen && (
            <div className="noise-body__facades">
              {groups.map((g) => (
                <Text key={`${g.side}-${g.dir}`} size="xs" c="dimmed">
                  {t('noise.group', { side: g.side === 'street' ? t('noise.street') : t('noise.courtyard'), dir: g.dir, len: Math.round(g.length_m), db: Math.round(g.lden) })}
                  {g.ln !== undefined && t('noise.groupNight', { ln: Math.round(g.ln) })}
                </Text>
              ))}
              {d.f17_lden_max !== undefined && d.f17_lden_max > 0 && (
                <Text size="xs" c="dimmed">
                  {t('noise.f17', { db: Math.round(d.f17_lden_max) })}
                  {d.f17_ln_max !== undefined && t('noise.f17Night', { ln: Math.round(d.f17_ln_max) })}
                </Text>
              )}
              {d.f17_leisure_ln_max !== undefined && d.f17_leisure_ln_max > 0 && (
                <Text size="xs" c="dimmed">{t('noise.leisure', { db: Math.round(d.f17_leisure_ln_max) })}</Text>
              )}
            </div>
          )}
        </>
      )}
      <Text size="xs" c="dimmed">{t('noise.modelled')}</Text>
      {sica && <Text size="xs" c="dimmed" fs="italic">{t('noise.sica')}</Text>}
      <Text size="xs" c="dimmed">{sica ? tl('context.noiseSica') : tl('context.noiseBcn')}</Text>
    </div>
  )
}

export interface DetailsViewProps {
  d: BuildingDetail | null
  facades: BuildingDetailResult['facades']
  weights: CompositeWeights
  components: ComponentScores
  penalties: { flood: number; fire: number; street: number }
  conditions: Conditions
  riskStrengths: { flood: number; fire: number; street: number }
  riskShown: boolean
  warning: string | null | undefined
  lden: number | null
  yearBuilt: number | null
  services: { cat: { id: string; label: string }; minutes: number | null }[]
  placeMinutes: (number | null)[]
  landmarks: { id: string; name: string; minutes: number }[]
  area: BuildingArea | null | undefined
  barri: BarriVibe | undefined
  barriData: BarriVibeData | null
  /** Sale prices (€/m²) of the areas of the same kind as the building's, for "how many fit your budget". */
  areaPrices: number[]
}

/** The technical details of the card (TODO-070, 072): photo and facts, then one collapsible row per section. */
export function DetailsView(p: DetailsViewProps) {
  const { t } = useTranslation('card')
  const [open, setOpen] = useState<Record<SectionId, boolean>>(OPEN_BY_DEFAULT)
  const toggle = (id: SectionId) => setOpen((o) => ({ ...o, [id]: !o[id] }))
  const { d, weights, components, conditions, area, barri } = p
  const ageDone = p.yearBuilt !== null && components.age !== null
  const riskPoints = p.penalties.flood + p.penalties.fire + p.penalties.street
  const riskNames = [
    p.penalties.flood > 0 && t('ui.riskRiver'), p.penalties.street > 0 && t('ui.riskStreet'), p.penalties.fire > 0 && t('ui.riskWildfire'),
  ].filter(Boolean).join(', ')
  const kind = area?.kind === 'barri' ? t('ui.kindBarri') : t('ui.kindMuni')

  return (
    <div className="details-view">
      <Section title={t('section.walkability')} score={weights.poiAccess > 0 ? components.poiAccess : null}
        verdict={weights.poiAccess > 0 ? countWithin(p.services.map((s) => s.minutes), conditions.walkMaxMin, 'services') : undefined}
        open={open.walk} onToggle={() => toggle('walk')}>
        <KeyValue rows={p.services.map(({ cat, minutes }) =>
          [cat.label, minutes !== null ? t('minutes', { n: minutes }) : t('ui.noneNearby')])} />
        <Text size="xs" c="dimmed">{t('ui.walkNote')}</Text>
      </Section>

      <Section title={t('section.noise')} score={weights.noise > 0 ? components.noise : null}
        verdict={weights.noise > 0 && p.lden !== null ? noiseVsLimit(p.lden, conditions.noiseMaxDb)
          : p.lden !== null ? `${Math.round(p.lden)} dB` : undefined}
        open={open.noise} onToggle={() => toggle('noise')}>
        {d ? <NoiseBody d={d} facades={p.facades} limit={conditions.noiseMaxDb} /> : <Text size="xs" c="dimmed">{t('ui.loading')}</Text>}
      </Section>

      {weights.cityCore > 0 && (
        <Section title={t('section.cityCore')} score={components.cityCore}
          verdict={countWithin(p.placeMinutes, conditions.cityCoreMaxMin, 'places')}
          open={open.core} onToggle={() => toggle('core')}>
          <div className="key-value">
            {p.landmarks.map((e) => <LandmarkRow key={e.id} name={e.name} minutes={e.minutes} />)}
          </div>
        </Section>
      )}

      {(weights.age ?? 0) > 0 && (
        <Section title={t('section.age')} score={components.age}
          verdict={!ageDone ? t('ui.yearUnknown')
            : t('ui.ageLine', { era: eraOf(p.yearBuilt!).name, years: eraOf(p.yearBuilt!).years, match: ageMatch(components.age!) })}
          note={d?.year_renov !== undefined ? <Text size="xs" c="dimmed">{t('ui.renovated', { year: d.year_renov })}</Text> : undefined} />
      )}

      {p.riskShown && d && (
        <Section title={t('section.climate')}
          lead={<span className="section-ring section-ring--risk" data-testid="risk-lead">{riskPoints > 0 ? `−${riskPoints}` : '0'}</span>}
          verdict={riskPoints > 0 ? t('ui.climateVerdict', { n: riskPoints, names: riskNames }) : t('ui.noPenalty')}
          open={open.risk} onToggle={() => toggle('risk')}>
          {p.warning && <div className="warning-box">{p.warning}</div>}
          {p.riskStrengths.flood > 0 && <RiskRow label={t('ui.riskRiver')} text={riverText(d.river_zone)} penalty={p.penalties.flood} />}
          {p.riskStrengths.street > 0 && (
            <RiskRow label={t('ui.riskStreet')} text={doorWaterText(d.street_t10_cm, d.street_t100_cm)} penalty={p.penalties.street} />
          )}
          {p.riskStrengths.fire > 0 && <RiskRow label={t('ui.riskWildfire')} text={fireText(d)} penalty={p.penalties.fire} />}
        </Section>
      )}

      {area && (
        <>
          <div className="barri-row">
            <span>{t('ui.sameFor', { kind })}</span>
            <b>{area.name}</b>
          </div>
          <Section title={t('section.price')} score={weights.openPrice > 0 ? components.openPrice : null}
            verdict={area.price !== null && weights.openPrice > 0 ? priceVsBudget(area.price, conditions.priceMaxEurM2) : undefined}
            open={open.price} onToggle={() => toggle('price')}>
            {area.price === null && <Text size="xs" c="dimmed">{t('ui.noPrice')}</Text>}
            {area.price !== null && weights.openPrice > 0 && (
              <Text size="xs">{t('ui.salePrice', { text: priceVsBudget(area.price, conditions.priceMaxEurM2) })}</Text>
            )}
            {area.price !== null && weights.openPrice > 0 && (() => {
              const budget = conditions.priceMaxEurM2
              const zeroAt = Math.round(budget * (1 + PRICE_FALLOFF_PCT / 100))
              const fit = p.areaPrices.filter((v) => priceOverPct(v, budget) === 0).length
              return (
                <>
                  <Text size="xs" c="dimmed">{t('ui.priceZeroAt', { price: fmt(zeroAt), pct: PRICE_FALLOFF_PCT })}</Text>
                  {p.areaPrices.length > 0 && (
                    <Text size="xs" c="dimmed">{t('ui.priceFit', { n: fit, total: p.areaPrices.length })}</Text>
                  )}
                </>
              )
            })()}
            {area.price !== null && weights.openPrice === 0 && (
              <Text size="xs"><Trans i18nKey="ui.salePriceOpen" ns="card" values={{ price: fmt(area.price) }} components={{ b: <b /> }} /></Text>
            )}
          </Section>
          {features.localsOpinion && p.barriData && (
            <Section title={t('ui.localsSay')} score={(weights.localsOpinion ?? 0) > 0 && barri ? components.localsOpinion : null}
              verdict={(weights.localsOpinion ?? 0) > 0 && barri ? ratingVsMin(barri.satisfAdj, conditions.localsMin) : undefined}
              open={open.locals} onToggle={() => toggle('locals')}>
              {barri ? <LocalsSay barri={barri} data={p.barriData} /> : <Text size="xs" c="dimmed">{t('ui.notBcn')}</Text>}
            </Section>
          )}
        </>
      )}

      {d && (
        <Section title={t('ui.details')}
          lead={<span className="section-ring section-ring--icon"><IconBuilding size={16} stroke={2} aria-hidden /></span>}
          open={open.building} onToggle={() => toggle('building')}>
          <BuildingStrip d={d} />
        </Section>
      )}
    </div>
  )
}
